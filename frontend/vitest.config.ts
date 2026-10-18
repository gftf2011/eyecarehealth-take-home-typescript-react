import react from '@vitejs/plugin-react';
import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';

/** Origem simulada do navegador nos testes: o cliente HTTP monta as URLs a partir dela. */
const TEST_ORIGIN = 'http://localhost:3000';

const dom: NonNullable<TestProjectInlineConfiguration['test']> = {
  environment: 'jsdom',
  environmentOptions: { jsdom: { url: TEST_ORIGIN } },
  setupFiles: ['src/shared-kernel/presentation/testing/setup-dom.ts'],
};

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.unit.spec.{ts,tsx}'], ...dom },
      },
      {
        extends: true,
        test: { name: 'integration', include: ['src/**/*.integration.spec.{ts,tsx}'], ...dom },
      },
      {
        extends: true,
        test: {
          name: 'architecture',
          include: ['src/**/*.architecture.spec.ts'],
          environment: 'node',
          globals: true,
          setupFiles: ['src/architecture/testing/register-archunit-matchers.ts'],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
