import { projectFiles, type FileInfo } from 'archunit';
import { describe, expect, it } from 'vitest';

import {
  fileNameOf,
  importSpecifiers,
  parentFolderOf,
  productionFiles,
  productionFilesInFolder,
} from './testing/project-structure';

/** O shared kernel tem pastas genéricas (componentes de UI, cliente HTTP). */
const SHARED_KERNEL = ['src/shared-kernel/**'];

/** Papéis permitidos dentro de `infra/` (um adapter por pasta de papel). */
const INFRA_ROLES = ['gateways', 'http', 'session', 'locks', 'clock', 'mappers'];

/** Teto de tamanho de um arquivo de produção. */
const MAX_PRODUCTION_LINES = 300;

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const rule = (description: string, condition: (file: FileInfo) => boolean) => ({ description, condition });

const baseName = (file: FileInfo): string => fileNameOf(file).replace(/\.(tsx?|module\.css)$/, '');

describe('Convenções de código', () => {
  it('imports sem extensão .js e sem /index (moduleResolution Bundler)', async () => {
    const importsAreClean = (file: FileInfo): boolean =>
      importSpecifiers(file).every((specifier) => !/\.jsx?$/.test(specifier) && !/\/index$/.test(specifier));

    const check = projectFiles()
      .inPath('src/**/*.{ts,tsx}')
      .should()
      .adhereTo(importsAreClean, 'Imports sem extensão .js e sem /index');

    await expect(check).toPassAsync();
  });

  it('todo teste declara o tipo no nome: *.unit|integration|e2e|architecture.spec.ts(x)', async () => {
    const check = projectFiles()
      .withName(/\.spec\.tsx?$/)
      .should()
      .haveName(/\.(unit|integration|e2e|architecture)\.spec\.tsx?$/);

    await expect(check).toPassAsync();
  });

  it(`arquivos de produção têm no máximo ${MAX_PRODUCTION_LINES} linhas`, async () => {
    const check = productionFiles('src/**/*.{ts,tsx}')
      .should()
      .adhereTo((file) => file.linesOfCode <= MAX_PRODUCTION_LINES, `Arquivo com mais de ${MAX_PRODUCTION_LINES} linhas`);

    await expect(check).toPassAsync();
  });

  it('JSX (React) só existe na apresentação e na composição (main)', async () => {
    const check = productionFiles('src/**/*.tsx').should().adhereTo(
      (file) => /^src\/[^/]+\/(presentation|main)\//.test(file.path) || file.path.startsWith('src/main/'),
      'Componentes React ficam em presentation/ ou main/',
    );

    await expect(check).toPassAsync();
  });
});

describe('Convenções da camada de aplicação', () => {
  it('cada caso de uso fica em usecases/<nome>/<nome>.usecase.ts e implementa UseCase', async () => {
    const { description, condition } = rule(
      'Caso de uso em usecases/<nome>/<nome>.usecase.ts, implementando UseCase',
      (file) => fileNameOf(file) === `${parentFolderOf(file)}.usecase.ts` && file.content.includes('implements UseCase<'),
    );

    const check = productionFiles('src/*/application/usecases/**').should().adhereTo(condition, description);

    await expect(check).toPassAsync();
  });

  it('arquivos *.usecase.ts só existem em application/usecases', async () => {
    const check = projectFiles().withName('*.usecase.ts').should().beInFolder('src/*/application/usecases/*');

    await expect(check).toPassAsync();
  });
});

describe('Convenções do domínio (por agregado)', () => {
  it('erros em errors/: um por arquivo, *.error.ts (mais o barrel index.ts)', async () => {
    const check = productionFilesInFolder('src/*/domain/**/errors', SHARED_KERNEL)
      .should()
      .haveName(/^(index|.+\.error)\.ts$/);

    await expect(check).toPassAsync();
  });

  it('value objects em value-objects/: um por arquivo, em kebab-case', async () => {
    const check = productionFilesInFolder('src/*/domain/**/value-objects', SHARED_KERNEL)
      .should()
      .adhereTo((file) => KEBAB_CASE.test(baseName(file)), 'Value object em <nome>.ts');

    await expect(check).toPassAsync();
  });
});

describe('Convenções da infra', () => {
  it(`infra organizada por papel: ${INFRA_ROLES.join(', ')}`, async () => {
    const check = productionFiles('src/*/infra/**', ['src/*/infra/index.ts'])
      .should()
      .adhereTo(
        (file) => INFRA_ROLES.includes(parentFolderOf(file)),
        `Arquivo de infra fora de ${INFRA_ROLES.join('/')}`,
      );

    await expect(check).toPassAsync();
  });
});

describe('Convenções da apresentação', () => {
  it('componentes e páginas: <nome>/<nome>.tsx, exportando o componente em PascalCase', async () => {
    const pascal = (kebab: string): string =>
      kebab.replace(/(^|-)([a-z0-9])/g, (_, __: string, letter: string) => letter.toUpperCase());

    const { description, condition } = rule(
      'Componente em <pasta>/<pasta>.tsx com `export function <NomeEmPascalCase>`',
      (file) => {
        if (!fileNameOf(file).endsWith('.tsx')) return fileNameOf(file).endsWith('.module.css');
        const folder = parentFolderOf(file);
        return (
          baseName(file) === folder &&
          KEBAB_CASE.test(folder) &&
          file.content.includes(`export function ${pascal(folder)}(`)
        );
      },
    );

    const check = productionFiles('src/*/presentation/{components,pages}/**').should().adhereTo(condition, description);

    await expect(check).toPassAsync();
  });

  it('páginas terminam em -page', async () => {
    const check = productionFilesInFolder('src/*/presentation/pages/*')
      .should()
      .adhereTo((file) => parentFolderOf(file).endsWith('-page'), 'Página em pages/<nome>-page/');

    await expect(check).toPassAsync();
  });

  it('hooks: presentation/hooks/use-*.ts, exportando a função use*', async () => {
    const check = productionFiles('src/*/presentation/hooks/**', ['src/*/presentation/hooks/index.ts'])
      .should()
      .adhereTo(
        (file) => /^use-[a-z0-9-]+\.ts$/.test(fileNameOf(file)) && /export function use[A-Z]\w*\(/.test(file.content),
        'Hook em hooks/use-<nome>.ts',
      );

    await expect(check).toPassAsync();
  });

  it('rotas: um arquivo por rota em presentation/routes/*.route.tsx', async () => {
    const { description, condition } = rule(
      'Um arquivo *.route.tsx por rota, exportando uma única função xRoute',
      (file) =>
        fileNameOf(file).endsWith('.route.tsx') &&
        [...file.content.matchAll(/export function \w+Route\(/g)].length === 1,
    );

    const check = productionFiles('src/*/presentation/routes/**').should().adhereTo(condition, description);

    await expect(check).toPassAsync();
  });
});
