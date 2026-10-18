import type { FileInfo } from 'archunit';
import { describe, expect, it } from 'vitest';

import { BOUNDED_CONTEXTS, importSpecifiers, packageOf, productionFiles } from './testing/project-structure';

/** Pares (contexto, outro contexto) para a regra de isolamento. */
const CROSS_CONTEXT = BOUNDED_CONTEXTS.flatMap((context) =>
  BOUNDED_CONTEXTS.filter((other) => other !== context).map((other) => [context, other] as const),
);

/**
 * Bibliotecas de infraestrutura: só adapters (infra, presentation do
 * framework) e composition roots podem conhecê-las.
 */
const INFRASTRUCTURE_PACKAGES = [
  'fastify',
  '@fastify/cookie',
  '@fastify/rate-limit',
  '@fastify/websocket',
  'kysely',
  'pg',
  'ioredis',
  '@aws-sdk/client-sns',
  '@aws-sdk/client-sqs',
  'jose',
  '@node-rs/bcrypt',
  'ws',
];

/** O domínio só importa código do próprio projeto e módulos nativos do Node. */
const domainIsFrameworkFree = (file: FileInfo): boolean =>
  importSpecifiers(file).every((specifier) => packageOf(specifier) === null);

const usesNoInfrastructurePackage = (file: FileInfo): boolean =>
  importSpecifiers(file).every((specifier) => !INFRASTRUCTURE_PACKAGES.includes(packageOf(specifier) ?? ''));

describe('Bounded contexts', () => {
  it.each(CROSS_CONTEXT)('%s não importa código de %s (fatos externos entram por ACL)', async (context, other) => {
    const rule = productionFiles(`src/${context}/**`).shouldNot().dependOnFiles().inPath(`src/${other}/**`);

    await expect(rule).toPassAsync();
  });

  it.each(BOUNDED_CONTEXTS)('o shared kernel não depende de %s', async (context) => {
    const rule = productionFiles('src/shared-kernel/**').shouldNot().dependOnFiles().inPath(`src/${context}/**`);

    await expect(rule).toPassAsync();
  });

  it('o shared kernel não depende dos entrypoints de src/main', async () => {
    const rule = productionFiles('src/shared-kernel/**').shouldNot().dependOnFiles().inPath('src/main/**');

    await expect(rule).toPassAsync();
  });
});

describe('Independência de frameworks', () => {
  it('o domínio não importa bibliotecas externas (só o próprio projeto e node:*)', async () => {
    const rule = productionFiles('src/*/domain/**')
      .should()
      .adhereTo(domainIsFrameworkFree, 'O domínio deve ser TypeScript puro, sem bibliotecas externas');

    await expect(rule).toPassAsync();
  });

  it('a aplicação não conhece banco, cache, HTTP nem criptografia', async () => {
    const rule = productionFiles('src/*/application/**')
      .should()
      .adhereTo(usesNoInfrastructurePackage, 'A aplicação depende de ports, não de bibliotecas de infraestrutura');

    await expect(rule).toPassAsync();
  });

  it('controllers e rotas não conhecem o framework HTTP', async () => {
    const rule = productionFiles('src/*/presentation/{controllers,routes}/**')
      .should()
      .adhereTo(usesNoInfrastructurePackage, 'Controllers e rotas são independentes do Fastify');

    await expect(rule).toPassAsync();
  });
});
