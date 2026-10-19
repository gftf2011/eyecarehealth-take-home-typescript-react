import { COURIER_PERMISSIONS, PERMISSIONS, type Permission } from '../../domain';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import type { Authenticator } from '../auth/authenticator';
import { InvalidTokenError, TokenExpiredError } from '../errors/http-errors';

export const ADMIN_TOKEN = 'test-admin-token';
export const VIEWER_TOKEN = 'test-viewer-token';
export const EXPIRED_TOKEN = 'test-expired-token';

const VIEWER_PERMISSIONS: readonly Permission[] = ['products:read', 'orders:read', 'reports:read'];
/** Como o perfil real: tudo do painel, nada das entregas do próprio entregador. */
const ADMIN_PERMISSIONS = PERMISSIONS.filter((permission) => !COURIER_PERMISSIONS.includes(permission));

const USERS: ReadonlyMap<string, AuthenticatedUser> = new Map([
  [ADMIN_TOKEN, { id: 'admin-id', role: 'admin', permissions: ADMIN_PERMISSIONS }],
  [VIEWER_TOKEN, { id: 'viewer-id', role: 'viewer', permissions: VIEWER_PERMISSIONS }],
]);

/**
 * Autenticador de teste com tokens fixos. Reproduz os mesmos erros que o
 * autenticador JWT real lançará (token ausente/inválido/expirado).
 */
export class StaticAuthenticator implements Authenticator {
  async authenticate(authorizationHeader: string | undefined): Promise<AuthenticatedUser> {
    const token = /^Bearer (.+)$/.exec(authorizationHeader ?? '')?.[1];
    if (token === EXPIRED_TOKEN) throw new TokenExpiredError();

    const user = token === undefined ? undefined : USERS.get(token);
    if (user === undefined) throw new InvalidTokenError();
    return user;
  }
}

export const bearer = (token: string): { authorization: string } => ({
  authorization: `Bearer ${token}`,
});
