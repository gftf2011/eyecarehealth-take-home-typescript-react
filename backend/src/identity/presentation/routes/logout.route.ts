import type { Controller, Route } from '../../../shared-kernel/presentation';
import { refreshCookieSchema } from '../schemas/auth.schemas';

/** Encerra a sessão do cookie de refresh (pública). */
export function logoutRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/auth/logout',
    permission: null,
    controller,
    docs: {
      summary: 'Sair',
      description: 'Revoga a sessão do refresh token e apaga o cookie. Idempotente: sem cookie ou com sessão já encerrada, também responde 204.',
      tags: ['Autenticação'],
      cookies: refreshCookieSchema.partial(),
      responses: { 204: { description: 'Sessão encerrada e cookie apagado' } },
    },
  };
}
