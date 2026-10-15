import { defineConfig } from 'vitest/config';

/**
 * O tipo do teste está no nome do arquivo, ao lado do código testado:
 * - `*.unit.spec.ts`: domínio e use cases com fakes; sem I/O.
 * - `*.integration.spec.ts`: adapters contra dependências reais (ex.: PostgreSQL).
 * - `*.e2e.spec.ts`: API HTTP de ponta a ponta.
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
        test: { name: 'integration', include: ['src/**/*.integration.spec.ts'] },
      },
      {
        extends: true,
        test: { name: 'e2e', include: ['src/**/*.e2e.spec.ts'] },
      },
    ],
  },
});
