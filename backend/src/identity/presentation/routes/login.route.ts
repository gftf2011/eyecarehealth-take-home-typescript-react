import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Autentica por email e senha (pública). */
export function loginRoute(controller: Controller): Route {
  return { method: 'POST', url: '/api/auth/login', permission: null, controller };
}
