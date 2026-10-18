import type { z } from 'zod';

import { SERVICE_UNAVAILABLE_CODES, ServiceUnavailableError } from '../../application';
import type { AccessTokenProvider } from './access-token-provider';
import { toRequestError } from './to-request-error';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

export type HttpRequestOptions = {
  readonly method?: HttpMethod;
  /** Caminho relativo à base da API (ex.: `/products`). */
  readonly path: string;
  /** Parâmetros de query; `null`/`undefined` são omitidos. */
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly body?: unknown;
  /** Envia o access token (padrão). `false` nas rotas públicas de autenticação. */
  readonly authenticated?: boolean;
  /** Cancelamento (ex.: o TanStack Query cancela consultas obsoletas). */
  readonly signal?: AbortSignal;
};

export type FetchHttpClientOptions = {
  /** URL absoluta da API (ex.: `http://localhost:3000/api`). */
  readonly baseUrl: string;
  readonly accessTokens?: AccessTokenProvider;
  readonly fetch?: typeof globalThis.fetch;
};

const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
const UNEXPECTED_RESPONSE_MESSAGE = 'O servidor respondeu num formato inesperado.';

/**
 * Cliente HTTP dos gateways: JSON, cookies da mesma origem (o refresh token
 * vive num cookie httpOnly), access token no `Authorization` e validação da
 * resposta com o schema do contrato. Toda falha vira uma categoria de erro da
 * aplicação. Num `401`, pede um token novo ao provider e tenta uma única vez.
 */
export class FetchHttpClient {
  private readonly baseUrl: string;
  private readonly fetch: typeof globalThis.fetch;

  constructor(private readonly options: FetchHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Requisição cuja resposta (validada por `schema`) é devolvida tipada. */
  async request<TSchema extends z.ZodType>(
    request: HttpRequestOptions,
    schema: TSchema,
  ): Promise<z.output<TSchema>> {
    const body = await this.send(request);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ServiceUnavailableError(
        SERVICE_UNAVAILABLE_CODES.unexpectedResponse,
        UNEXPECTED_RESPONSE_MESSAGE,
      );
    }
    return parsed.data;
  }

  /** Requisição sem corpo de resposta relevante (ex.: `204`). */
  async requestVoid(request: HttpRequestOptions): Promise<void> {
    await this.send(request);
  }

  private async send(request: HttpRequestOptions): Promise<unknown> {
    const authenticated = request.authenticated ?? true;
    const provider = authenticated ? this.options.accessTokens : undefined;

    const token = provider === undefined ? null : await provider.currentToken();
    let response = await this.dispatch(request, token);

    if (response.status === 401 && provider !== undefined && token !== null) {
      const renewed = await provider.tokenRejected(token);
      if (renewed !== null) response = await this.dispatch(request, renewed);
    }

    const body = await readBody(response);
    if (!response.ok) {
      throw toRequestError(response.status, body, response.headers.get('Retry-After'));
    }
    return body;
  }

  private async dispatch(request: HttpRequestOptions, token: string | null): Promise<Response> {
    const headers = new Headers({ Accept: 'application/json' });
    if (request.body !== undefined) headers.set('Content-Type', 'application/json');
    if (token !== null) headers.set('Authorization', `Bearer ${token}`);

    const init: RequestInit = {
      method: request.method ?? 'GET',
      headers,
      credentials: 'same-origin',
    };
    if (request.body !== undefined) init.body = JSON.stringify(request.body);
    if (request.signal !== undefined) init.signal = request.signal;

    try {
      return await this.fetch(this.urlFor(request), init);
    } catch (error) {
      // Cancelamento não é falha de rede: quem cancelou trata.
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ServiceUnavailableError(SERVICE_UNAVAILABLE_CODES.network, NETWORK_ERROR_MESSAGE);
    }
  }

  private urlFor(request: HttpRequestOptions): string {
    const url = new URL(`${this.baseUrl}${request.path}`);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
