import { errorResponseSchema, type Controller, type Route } from '../../../shared-kernel/presentation';
import { refreshCookieSchema, sessionSchema } from '../schemas/auth.schemas';

/** Renova a sessão pelo cookie de refresh (pública: o cookie é a credencial). */
export function refreshSessionRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/auth/refresh',
    permission: null,
    controller,
    docs: {
      summary: 'Renovar sessão',
      description:
        'Lê o refresh token do cookie, o gira (o anterior deixa de valer) e devolve um access token novo. Reapresentar um refresh token já girado é tratado como roubo e revoga a sessão inteira.',
      tags: ['Autenticação'],
      cookies: refreshCookieSchema,
      responses: {
        200: { description: 'Access token novo; o refresh token girado vai no `Set-Cookie`', schema: sessionSchema },
        401: { description: 'Sem cookie, refresh token inválido, expirado, revogado ou reusado (`INVALID_REFRESH_TOKEN`)', schema: errorResponseSchema },
      },
    },
  };
}
