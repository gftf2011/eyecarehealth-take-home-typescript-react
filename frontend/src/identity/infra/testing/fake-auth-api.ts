import { http, HttpResponse, type HttpHandler } from 'msw';

import { apiUrl } from '../../../shared-kernel/infra/testing/test-api';

type FakeUser = { id: string; email: string; password: string; role: 'admin' | 'viewer' };

export const SEED_USERS = {
  admin: { id: 'user-admin', email: 'admin@fastmeals.com', password: 'Admin@123', role: 'admin' },
  viewer: { id: 'user-viewer', email: 'viewer@fastmeals.com', password: 'Viewer@123', role: 'viewer' },
} as const satisfies Record<string, FakeUser>;

function apiError(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

/**
 * Imitação das rotas `/api/auth/*` com o comportamento da API real: o
 * "cookie" de refresh é o estado guardado aqui (o fetch do Node não tem
 * cookie jar), rotacionado a cada renovação.
 */
export class FakeAuthApi {
  tokenTtlMs = 15 * 60_000;
  loginCalls = 0;
  refreshCalls = 0;
  logoutCalls = 0;

  #cookieUser: FakeUser | null = null;
  #issued = 0;

  /** Simula um navegador que já tinha logado antes de recarregar a página. */
  givenSignedIn(user: FakeUser = SEED_USERS.admin): void {
    this.#cookieUser = user;
  }

  /** O servidor revogou a sessão (logout em outra aba, reuso detectado, 7 dias). */
  revokeSession(): void {
    this.#cookieUser = null;
  }

  handlers(): HttpHandler[] {
    return [
      http.post(apiUrl('/auth/login'), async ({ request }) => {
        this.loginCalls += 1;
        const body = (await request.json()) as Partial<Record<'email' | 'password', unknown>>;
        const user = Object.values(SEED_USERS).find(
          (candidate) => candidate.email === body.email && candidate.password === body.password,
        );
        if (user === undefined) return apiError(401, 'INVALID_CREDENTIALS', 'Email ou senha inválidos');
        this.#cookieUser = user;
        return HttpResponse.json(this.#sessionBody(user));
      }),

      http.post(apiUrl('/auth/refresh'), () => {
        this.refreshCalls += 1;
        if (this.#cookieUser === null) {
          return apiError(401, 'INVALID_REFRESH_TOKEN', 'Sessão inválida ou expirada');
        }
        return HttpResponse.json(this.#sessionBody(this.#cookieUser));
      }),

      http.post(apiUrl('/auth/logout'), () => {
        this.logoutCalls += 1;
        this.#cookieUser = null;
        return new HttpResponse(null, { status: 204 });
      }),
    ];
  }

  #sessionBody(user: FakeUser) {
    this.#issued += 1;
    return {
      accessToken: `access-${this.#issued}`,
      accessTokenExpiresAt: new Date(Date.now() + this.tokenTtlMs).toISOString(),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
