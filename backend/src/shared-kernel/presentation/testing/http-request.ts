import { ANONYMOUS_USER } from '../auth/authenticated-user';
import type { HttpRequest } from '../http/http';

/** Requisição de teste com valores neutros; sobrescreva só o que importa. */
export function httpRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    params: {},
    query: {},
    body: undefined,
    cookies: {},
    ip: '127.0.0.1',
    user: ANONYMOUS_USER,
    ...overrides,
  };
}
