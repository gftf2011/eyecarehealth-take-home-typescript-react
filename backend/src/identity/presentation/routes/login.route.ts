import { errorResponseSchema, type Controller, type Route } from '../../../shared-kernel/presentation';
import { loginBodySchema, sessionSchema } from '../schemas/auth.schemas';

/** Entra com email e senha (pública). */
export function loginRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/auth/login',
    permission: null,
    controller,
    docs: {
      summary: 'Entrar',
      description:
        'Devolve o access token (15 min) no corpo e grava o refresh token (7 dias, rotativo) no cookie `httpOnly`. Tentativas erradas por email + IP são limitadas.',
      tags: ['Autenticação'],
      body: loginBodySchema,
      responses: {
        200: { description: 'Sessão aberta; o refresh token vai no `Set-Cookie`', schema: sessionSchema },
        401: { description: 'Email ou senha incorretos (`INVALID_CREDENTIALS`)', schema: errorResponseSchema },
        429: {
          description: 'Muitas tentativas erradas (`TOO_MANY_LOGIN_ATTEMPTS`) ou limite de requisições (`RATE_LIMIT_EXCEEDED`)',
          schema: errorResponseSchema,
        },
      },
    },
  };
}
