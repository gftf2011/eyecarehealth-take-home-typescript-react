import type { AuthenticatedUser } from '../auth/authenticated-user';

/**
 * Requisição HTTP já autenticada, independente de framework. Os campos chegam
 * crus (`unknown`): cada controller valida o formato com o seu schema.
 */
export type HttpRequest = {
  readonly params: unknown;
  readonly query: unknown;
  readonly body: unknown;
  readonly user: AuthenticatedUser;
};

export type HttpResponse = {
  readonly status: number;
  readonly body?: unknown;
};

/**
 * Adapter de entrada: traduz HTTP ↔ caso de uso. Não contém regra de negócio
 * nem conhece o framework HTTP.
 */
export interface Controller {
  handle(request: HttpRequest): Promise<HttpResponse>;
}

export const ok = (body: unknown): HttpResponse => ({ status: 200, body });
export const created = (body: unknown): HttpResponse => ({ status: 201, body });
export const noContent = (): HttpResponse => ({ status: 204 });
