import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Encerra a sessão do cookie de refresh (pública). */
export function logoutRoute(controller: Controller): Route {
  return { method: 'POST', url: '/api/auth/logout', permission: null, controller };
}
