import { z } from 'zod';

import type { FetchHttpClient } from '../../../shared-kernel/infra';
import type { AuthGateway, IssuedSession } from '../../application';

/** Corpo de `POST /auth/login` e `POST /auth/refresh` (o refresh token vem só no cookie). */
const issuedSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  user: z.object({
    id: z.string().min(1),
    email: z.string(),
    role: z.string(),
  }),
});

/**
 * Rotas públicas de autenticação: não levam access token (o cliente HTTP
 * recebido não tem provider, para a renovação nunca disparar outra renovação).
 */
export class HttpAuthGateway implements AuthGateway {
  constructor(private readonly http: FetchHttpClient) {}

  login(credentials: { email: string; password: string }): Promise<IssuedSession> {
    return this.http.request(
      { method: 'POST', path: '/auth/login', body: credentials, authenticated: false },
      issuedSessionSchema,
    );
  }

  renew(): Promise<IssuedSession> {
    return this.http.request(
      { method: 'POST', path: '/auth/refresh', authenticated: false },
      issuedSessionSchema,
    );
  }

  logout(): Promise<void> {
    return this.http.requestVoid({ method: 'POST', path: '/auth/logout', authenticated: false });
  }
}
