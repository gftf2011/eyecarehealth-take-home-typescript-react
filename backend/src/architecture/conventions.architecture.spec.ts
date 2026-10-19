import { projectFiles, type FileInfo } from 'archunit';
import { describe, expect, it } from 'vitest';

import {
  fileNameOf,
  importSpecifiers,
  parentFolderOf,
  productionFiles,
  productionFilesInFolder,
} from './testing/project-structure';

/** Bounded contexts: o shared kernel tem pastas genéricas (bases, mediator). */
const SHARED_KERNEL = ['src/shared-kernel/**'];

/** Papéis permitidos dentro de `infra/persistence/`. */
const PERSISTENCE_ROLES = ['schema', 'migrations', 'mappers', 'repositories', 'acl', 'unit-of-work', 'queries'];

/** Teto de tamanho de um arquivo de produção (o maior hoje é o agregado Order). */
const MAX_PRODUCTION_LINES = 400;

const rule = (description: string, condition: (file: FileInfo) => boolean) => ({ description, condition });

describe('Convenções de código', () => {
  it('imports sem extensão .js e sem /index (moduleResolution Bundler)', async () => {
    const importsAreClean = (file: FileInfo): boolean =>
      importSpecifiers(file).every((specifier) => !specifier.endsWith('.js') && !specifier.endsWith('/index'));

    const check = projectFiles()
      .inPath('src/**/*.ts')
      .should()
      .adhereTo(importsAreClean, 'Imports sem extensão .js e sem /index');

    await expect(check).toPassAsync();
  });

  it('todo teste declara o tipo no nome: *.unit|integration|e2e|architecture.spec.ts', async () => {
    const check = projectFiles()
      .withName('*.spec.ts')
      .should()
      .haveName(/\.(unit|integration|e2e|architecture)\.spec\.ts$/);

    await expect(check).toPassAsync();
  });

  it('arquivos de produção têm no máximo 400 linhas', async () => {
    const check = productionFiles('src/**/*.ts')
      .should()
      .adhereTo((file) => file.linesOfCode <= MAX_PRODUCTION_LINES, `Arquivo com mais de ${MAX_PRODUCTION_LINES} linhas`);

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

  it('eventos em events/: *.event.ts, o tipo do agregado e o barrel', async () => {
    const check = productionFilesInFolder('src/*/domain/**/events', SHARED_KERNEL)
      .should()
      .haveName(/^(index|.+\.event|.+-aggregate-type)\.ts$/);

    await expect(check).toPassAsync();
  });

  it('repositórios do domínio estendem Repository<Agregado> (só raízes de agregado)', async () => {
    const { description, condition } = rule(
      'Contrato *.repository.ts estende Repository<T extends AggregateRoot>',
      (file) => file.content.includes('extends Repository<'),
    );

    const check = productionFiles('src/*/domain/**/repositories/*.repository.ts', SHARED_KERNEL)
      .should()
      .adhereTo(condition, description);

    await expect(check).toPassAsync();
  });

  it('repositories/ do domínio só tem contratos e critérios de consulta', async () => {
    const check = productionFilesInFolder('src/*/domain/**/repositories', SHARED_KERNEL)
      .should()
      .haveName(/^.+\.repository\.ts$|^.+-criteria\.ts$/);

    await expect(check).toPassAsync();
  });
});

describe('Convenções da infra e da apresentação', () => {
  it(`infra/persistence organizada por papel: ${PERSISTENCE_ROLES.join(', ')}`, async () => {
    const check = productionFiles('src/*/infra/persistence/**')
      .should()
      .adhereTo(
        (file) => PERSISTENCE_ROLES.includes(parentFolderOf(file)),
        `Arquivo de persistência fora de ${PERSISTENCE_ROLES.join('/')}`,
      );

    await expect(check).toPassAsync();
  });

  it('controllers: classe XController em presentation/controllers/*.controller.ts, implementando Controller', async () => {
    const { description, condition } = rule(
      'Controller em presentation/controllers/<nome>.controller.ts',
      (file) => {
        const declaresController = /export class \w+Controller\b/.test(file.content);
        if (!declaresController) return !fileNameOf(file).endsWith('.controller.ts');
        return (
          fileNameOf(file).endsWith('.controller.ts') &&
          parentFolderOf(file) === 'controllers' &&
          file.content.includes('implements Controller')
        );
      },
    );

    const check = productionFiles('src/*/presentation/**').should().adhereTo(condition, description);

    await expect(check).toPassAsync();
  });

  it('rotas: um arquivo por rota em presentation/routes/*.route.ts', async () => {
    const { description, condition } = rule(
      'Um arquivo *.route.ts por rota, exportando uma única função xRoute',
      (file) => fileNameOf(file).endsWith('.route.ts') && [...file.content.matchAll(/export function \w+Route\(/g)].length === 1,
    );

    const check = productionFiles('src/*/presentation/routes/**').should().adhereTo(condition, description);

    await expect(check).toPassAsync();
  });
});
