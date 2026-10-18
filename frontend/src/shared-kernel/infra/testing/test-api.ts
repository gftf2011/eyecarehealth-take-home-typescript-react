import { setupServer } from 'msw/node';

/** Mesma origem do jsdom (vitest.config.ts): a API fica em `/api`, como no navegador. */
export const TEST_API_BASE_URL = 'http://localhost:3000/api';

/** WebSocket do tempo real na mesma origem (interceptado pelo MSW com `ws.link`). */
export const TEST_REALTIME_URL = 'ws://localhost:3000/realtime';

export function apiUrl(path: string): string {
  return `${TEST_API_BASE_URL}${path}`;
}

/**
 * Servidor MSW dos testes: intercepta o `fetch` e responde como a API.
 * Requisição sem handler falha o teste (nada sai para a rede).
 */
export function createTestApiServer() {
  const server = setupServer();
  return {
    server,
    listen: () => server.listen({ onUnhandledFrame: 'error' }),
    reset: () => server.resetHandlers(),
    close: () => server.close(),
  };
}
