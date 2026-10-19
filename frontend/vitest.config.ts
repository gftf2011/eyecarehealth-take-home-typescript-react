import react from '@vitejs/plugin-react';
import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';

/** Origem simulada do navegador nos testes: o cliente HTTP monta as URLs a partir dela. */
const TEST_ORIGIN = 'http://localhost:3000';

const SETUP_DOM = 'src/shared-kernel/presentation/testing/setup-dom.ts';

const dom: NonNullable<TestProjectInlineConfiguration['test']> = {
  environment: 'jsdom',
  environmentOptions: { jsdom: { url: TEST_ORIGIN } },
  setupFiles: [SETUP_DOM],
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
        test: {
          name: 'integration',
          include: ['src/**/*.integration.spec.{ts,tsx}'],
          ...dom,
          // Telas carregadas antes dos testes (ver o arquivo).
          setupFiles: [SETUP_DOM, 'src/main/testing/preload-screens.ts'],
          // Um teste de tela inteira pode durar alguns segundos de propósito (o tempo real
          // espera o intervalo entre recargas); as asserções têm os próprios prazos.
          testTimeout: 15_000,
        },
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
