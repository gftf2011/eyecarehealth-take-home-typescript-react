import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Renova a sessão a partir do cookie de refresh (pública). */
export function refreshSessionRoute(controller: Controller): Route {
  return { method: 'POST', url: '/api/auth/refresh', permission: null, controller };
}
