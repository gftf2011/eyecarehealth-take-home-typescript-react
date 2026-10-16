import type { HttpRequest, ResponseCookie } from '../../../shared-kernel/presentation';

export const REFRESH_TOKEN_COOKIE = 'fastmeals_refresh';

/**
 * Refresh token só trafega neste cookie — nunca no corpo nem acessível ao
 * JavaScript do frontend:
 * - httpOnly: um XSS não consegue lê-lo;
 * - SameSite=Strict + Path=/api/auth: só volta ao servidor nas rotas de auth,
 *   e nunca em requisições originadas de outro site (CSRF);
 * - Secure: só via HTTPS (desligável apenas em desenvolvimento local).
 */
export class RefreshTokenCookie {
  constructor(private readonly secure: boolean) {}

  set(token: string, expires: Date): ResponseCookie {
    return { name: REFRESH_TOKEN_COOKIE, value: token, options: this.options(expires) };
  }

  clear(): ResponseCookie {
    return { name: REFRESH_TOKEN_COOKIE, value: null, options: this.options(new Date(0)) };
  }

  read(request: HttpRequest): string | undefined {
    return request.cookies[REFRESH_TOKEN_COOKIE];
  }

  private options(expires: Date): ResponseCookie['options'] {
    return { httpOnly: true, secure: this.secure, sameSite: 'strict', path: '/api/auth', expires };
  }
}
