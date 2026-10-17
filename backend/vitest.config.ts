import { defineConfig } from 'vitest/config';

/**
 * O tipo do teste está no nome do arquivo, ao lado do código testado:
 * - `*.unit.spec.ts`: domínio e use cases com fakes; sem I/O.
 * - `*.integration.spec.ts`: adapters contra dependências reais (PostgreSQL via
 *   Testcontainers — exige Docker em execução).
 * - `*.e2e.spec.ts`: API HTTP de ponta a ponta.
 * - `*.architecture.spec.ts`: regras de arquitetura (ArchUnitTS) sobre o
 *   código-fonte; sem I/O além de ler os arquivos.
 */
export default defineConfig({
  test: {
    environment: 'node',
    clearMocks: true,
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.unit.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'architecture',
          include: ['src/**/*.architecture.spec.ts'],
          // O ArchUnitTS registra `toPassAsync` no `expect` global: `globals`
          // fica ligado só neste projeto; os demais seguem importando de 'vitest'.
          globals: true,
          setupFiles: ['src/architecture/testing/register-archunit-matchers.ts'],
          // Monta o grafo de dependências do projeto inteiro (TypeScript compiler).
          testTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.spec.ts'],
          globalSetup: ['src/main/database/testing/containers-global-setup.ts'],
          // Um único banco compartilhado: arquivos rodam em sequência.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['src/**/*.e2e.spec.ts'],
          globalSetup: ['src/main/database/testing/containers-global-setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
