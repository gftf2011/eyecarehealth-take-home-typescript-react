import type { FileInfo } from 'archunit';
import { describe, expect, it } from 'vitest';

import {
  BOUNDED_CONTEXTS,
  INFRASTRUCTURE_FOLDERS,
  importSpecifiers,
  packageOf,
  productionFiles,
  sourceFolders,
} from './testing/project-structure';

/** Pares (contexto, outro contexto) para a regra de isolamento. */
const CROSS_CONTEXT = BOUNDED_CONTEXTS.flatMap((context) =>
  BOUNDED_CONTEXTS.filter((other) => other !== context).map((other) => [context, other] as const),
);

/** Bibliotecas de interface e de transporte: a aplicação não pode conhecê-las. */
const UI_AND_TRANSPORT_PACKAGES = [
  'react',
  'react-dom',
  'react-router',
  '@tanstack/react-query',
  'msw',
];

/**
 * APIs do navegador: na aplicação e no domínio elas entram por ports
 * (implementados na infra), para as regras rodarem e serem testadas sem DOM.
 */
const BROWSER_APIS = /\b(fetch|window|document|localStorage|sessionStorage|navigator|setTimeout|setInterval)\b\s*[.(]/;

const onlyProjectImports = (file: FileInfo): boolean =>
  importSpecifiers(file).every((specifier) => packageOf(specifier) === null);

const noUiOrTransportPackage = (file: FileInfo): boolean =>
  importSpecifiers(file).every((specifier) => !UI_AND_TRANSPORT_PACKAGES.includes(packageOf(specifier) ?? ''));

const noBrowserApi = (file: FileInfo): boolean => !BROWSER_APIS.test(file.content);

describe('Bounded contexts', () => {
  it('toda pasta de src/ é um contexto registrado ou uma pasta de infraestrutura', () => {
    expect(sourceFolders()).toEqual([...BOUNDED_CONTEXTS, ...INFRASTRUCTURE_FOLDERS].sort());
  });

  it.runIf(CROSS_CONTEXT.length > 0).each(CROSS_CONTEXT)(
    '%s não importa código de %s (fatos externos entram por ports)',
    async (context, other) => {
      const rule = productionFiles(`src/${context}/**`).shouldNot().dependOnFiles().inPath(`src/${other}/**`);

      await expect(rule).toPassAsync();
    },
  );

  it.each(BOUNDED_CONTEXTS)('o shared kernel não depende de %s', async (context) => {
    const rule = productionFiles('src/shared-kernel/**').shouldNot().dependOnFiles().inPath(`src/${context}/**`);

    await expect(rule).toPassAsync();
  });

  it('o shared kernel não depende da composição em src/main', async () => {
    const rule = productionFiles('src/shared-kernel/**').shouldNot().dependOnFiles().inPath('src/main/**');

    await expect(rule).toPassAsync();
  });
});

describe('Independência de frameworks', () => {
  it('o domínio é TypeScript puro: nenhuma biblioteca externa', async () => {
    const rule = productionFiles('src/*/domain/**')
      .should()
      .adhereTo(onlyProjectImports, 'O domínio não importa bibliotecas externas');

    await expect(rule).toPassAsync();
  });

  it('a aplicação não conhece React, roteador, cache de consultas nem HTTP', async () => {
    const rule = productionFiles('src/*/application/**')
      .should()
      .adhereTo(noUiOrTransportPackage, 'A aplicação depende de ports, não de bibliotecas de interface');

    await expect(rule).toPassAsync();
  });

  it.each(['domain', 'application'])('%s não usa APIs do navegador diretamente', async (layer) => {
    const rule = productionFiles(`src/*/${layer}/**`)
      .should()
      .adhereTo(noBrowserApi, 'fetch, window, document, storage e timers entram por ports');

    await expect(rule).toPassAsync();
  });

  it('a apresentação não faz requisições HTTP (usa os casos de uso)', async () => {
    const rule = productionFiles('src/*/presentation/**')
      .should()
      .adhereTo((file) => !/\bfetch\s*\(/.test(file.content), 'Telas não chamam fetch');

    await expect(rule).toPassAsync();
  });
});
