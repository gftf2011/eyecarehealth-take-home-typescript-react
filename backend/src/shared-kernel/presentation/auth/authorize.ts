import type { Permission } from '../../domain';
import { ForbiddenError } from '../errors/http-errors';
import { ANONYMOUS_USER, type AuthenticatedUser } from './authenticated-user';
import type { Authenticator } from './authenticator';

/**
 * Guarda de rota: rotas públicas (`permission: null`) não exigem token; as
 * demais exigem token válido (401) e a permissão declarada (403).
 */
export async function authorize(
  authenticator: Authenticator,
  authorizationHeader: string | undefined,
  permission: Permission | null,
): Promise<AuthenticatedUser> {
  if (permission === null) return ANONYMOUS_USER;

  const user = await authenticator.authenticate(authorizationHeader);
  if (!user.permissions.includes(permission)) throw new ForbiddenError(permission);
  return user;
}
