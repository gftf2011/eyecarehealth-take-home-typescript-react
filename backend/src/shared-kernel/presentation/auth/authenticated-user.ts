import type { Permission } from '../../domain';

/** Quem está fazendo a requisição, já com o token verificado. */
export type AuthenticatedUser = {
  readonly id: string;
  readonly role: string;
  readonly permissions: readonly Permission[];
};

/** Usuário de rotas públicas (sem token). */
export const ANONYMOUS_USER: AuthenticatedUser = Object.freeze({
  id: 'anonymous',
  role: 'anonymous',
  permissions: [],
});
