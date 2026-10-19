import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  BusinessRuleRejectedError,
  ForbiddenError,
  InputValidationError,
  RateLimitedError,
  RequestConflictError,
  ResourceNotFoundError,
  ServiceUnavailableError,
  UnauthenticatedError,
} from '../../application';
import type { AccessTokenProvider } from './access-token-provider';
import { FetchHttpClient } from './fetch-http.client';

const BASE_URL = 'http://localhost:3000/api';
const productSchema = z.object({ id: z.string(), price: z.number() });

type Call = { url: string; init: RequestInit };

function fakeFetch(...responses: Response[]) {
  const calls: Call[] = [];
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const next = responses.shift();
    return next === undefined ? Promise.reject(new Error('sem resposta')) : Promise.resolve(next);
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function apiError(status: number, code: string, details: unknown[] = []) {
  return json(status, { error: { code, message: `mensagem ${code}`, details } });
}

function tokens(current: string | null, renewed: string | null = null): AccessTokenProvider {
  return {
    currentToken: vi.fn(() => Promise.resolve(current)),
    tokenRejected: vi.fn(() => Promise.resolve(renewed)),
  };
}

describe('FetchHttpClient', () => {
  it('monta a URL com a query (sem valores vazios) e valida a resposta', async () => {
    const { fetch, calls } = fakeFetch(json(200, { id: 'p1', price: 32.9 }));
    const client = new FetchHttpClient({ baseUrl: `${BASE_URL}/`, fetch });

    const product = await client.request(
      { path: '/products', query: { page: 2, search: 'x burger', category: undefined, isAvailable: null } },
      productSchema,
    );

    expect(product).toEqual({ id: 'p1', price: 32.9 });
    expect(calls[0]?.url).toBe(`${BASE_URL}/products?page=2&search=x+burger`);
    expect(calls[0]?.init.credentials).toBe('same-origin');
  });

  it('envia JSON e o access token', async () => {
    const { fetch, calls } = fakeFetch(json(201, { id: 'p1', price: 10 }));
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch, accessTokens: tokens('token-1') });

    await client.request({ method: 'POST', path: '/products', body: { name: 'X' } }, productSchema);

    const headers = new Headers(calls[0]?.init.headers);
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe('{"name":"X"}');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer token-1');
  });

  it('rotas públicas não pedem nem enviam token', async () => {
    const provider = tokens('token-1');
    const { fetch, calls } = fakeFetch(new Response(null, { status: 204 }));
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch, accessTokens: provider });

    await client.requestVoid({ method: 'POST', path: '/auth/logout', authenticated: false });

    expect(provider.currentToken).not.toHaveBeenCalled();
    expect(new Headers(calls[0]?.init.headers).has('Authorization')).toBe(false);
  });

  it.each([
    [400, InputValidationError],
    [401, UnauthenticatedError],
    [403, ForbiddenError],
    [404, ResourceNotFoundError],
    [409, RequestConflictError],
    [422, BusinessRuleRejectedError],
    [429, RateLimitedError],
    [500, ServiceUnavailableError],
    [503, ServiceUnavailableError],
  ])('status %i vira %s', async (status, category) => {
    const { fetch } = fakeFetch(apiError(status, 'CODIGO'));
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch });

    await expect(client.request({ path: '/x' }, productSchema)).rejects.toBeInstanceOf(category);
  });

  it('503 com motivo da API mostra a mensagem dela (ex.: otimizador ocupado)', async () => {
    const message = 'O otimizador está ocupado com outras sugestões. Tente novamente em instantes.';
    const { fetch } = fakeFetch(json(503, { error: { code: 'OPTIMIZER_BUSY', message, details: [{ timeoutMs: 10 }] } }));
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch });

    const error = await client.request({ path: '/x' }, productSchema).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ code: 'TEMPORARILY_UNAVAILABLE', message });
  });

  it('500 continua com a mensagem genérica, sem expor o erro do servidor', async () => {
    const { fetch } = fakeFetch(json(500, { error: { code: 'INTERNAL_ERROR', message: 'stack trace' } }));
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch });

    const error = await client.request({ path: '/x' }, productSchema).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'SERVER_ERROR', message: 'O servidor encontrou um erro. Tente novamente em instantes.' });
  });

  it('mantém código, mensagem e detalhes por campo da API', async () => {
    const { fetch } = fakeFetch(
      apiError(400, 'VALIDATION_ERROR', [{ field: 'price', message: 'O preço deve ser maior que zero' }]),
    );
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch });

    const error = await client.request({ path: '/x' }, productSchema).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InputValidationError);
    expect((error as InputValidationError).messagesByField()).toEqual({
      price: 'O preço deve ser maior que zero',
    });
  });

  it('429 informa quando tentar de novo', async () => {
    const { fetch } = fakeFetch(
      json(429, { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Calma' } }, { 'Retry-After': '42' }),
    );
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch });

    await expect(client.request({ path: '/x' }, productSchema)).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: 42,
    });
  });

  it('sem conexão vira ServiceUnavailableError(NETWORK_ERROR)', async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch });

    await expect(client.request({ path: '/x' }, productSchema)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('cancelamento continua sendo cancelamento', async () => {
    const abort = new DOMException('cancelado', 'AbortError');
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch: vi.fn(() => Promise.reject(abort)) });

    await expect(client.request({ path: '/x' }, productSchema)).rejects.toBe(abort);
  });

  it('resposta fora do contrato vira UNEXPECTED_RESPONSE', async () => {
    const { fetch } = fakeFetch(json(200, { id: 1 }));
    const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch });

    await expect(client.request({ path: '/x' }, productSchema)).rejects.toMatchObject({
      code: 'UNEXPECTED_RESPONSE',
    });
  });

  describe('401 com sessão', () => {
    it('renova o token e repete a requisição uma vez', async () => {
      const provider = tokens('velho', 'novo');
      const { fetch, calls } = fakeFetch(apiError(401, 'TOKEN_EXPIRED'), json(200, { id: 'p1', price: 1 }));
      const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch, accessTokens: provider });

      await expect(client.request({ path: '/x' }, productSchema)).resolves.toEqual({ id: 'p1', price: 1 });
      expect(provider.tokenRejected).toHaveBeenCalledWith('velho');
      expect(new Headers(calls[1]?.init.headers).get('Authorization')).toBe('Bearer novo');
    });

    it('sessão acabou: não repete e devolve o 401', async () => {
      const { fetch, calls } = fakeFetch(apiError(401, 'TOKEN_EXPIRED'));
      const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch, accessTokens: tokens('velho', null) });

      await expect(client.request({ path: '/x' }, productSchema)).rejects.toBeInstanceOf(UnauthenticatedError);
      expect(calls).toHaveLength(1);
    });

    it('401 de novo depois de renovar: não entra em laço', async () => {
      const { fetch, calls } = fakeFetch(apiError(401, 'TOKEN_EXPIRED'), apiError(401, 'INVALID_TOKEN'));
      const client = new FetchHttpClient({ baseUrl: BASE_URL, fetch, accessTokens: tokens('velho', 'novo') });

      await expect(client.request({ path: '/x' }, productSchema)).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
      expect(calls).toHaveLength(2);
    });
  });
});
