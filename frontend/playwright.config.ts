import { defineConfig, devices } from '@playwright/test';

import { E2E_BASE_URL } from './e2e/support/stack';

/**
 * Testes de ponta a ponta: um navegador de verdade contra o sistema inteiro
 * (nginx, API, gateway, relay, PostgreSQL, Redis e Floci), numa stack Docker
 * **isolada** (projeto `fastmeals-e2e`, portas próprias e banco novo com o
 * seed a cada rodada). Os dados de desenvolvimento não são tocados.
 *
 *   npm run test:e2e                 sobe a stack, roda e derruba
 *   E2E_KEEP_STACK=1 npm run test:e2e   mantém a stack no fim (depurar)
 *   E2E_BASE_URL=http://… npm run test:e2e   usa uma stack já de pé
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Um banco para todos: em sequência, cada teste vê o efeito só dos anteriores.
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env['CI'] !== undefined,
  retries: process.env['CI'] !== undefined ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  use: {
    baseURL: E2E_BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
