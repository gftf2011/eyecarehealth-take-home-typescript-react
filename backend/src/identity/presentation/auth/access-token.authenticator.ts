import { InvalidTokenError } from '../../../shared-kernel/application';
import type { AuthenticatedUser, Authenticator } from '../../../shared-kernel/presentation';
import type { AccessTokenVerifier } from '../../application/ports/access-token.service';
import { Role } from '../../domain';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Autenticador real da API: lê `Authorization: Bearer <access token>`,
 * verifica o JWT e deriva as permissões do papel. Sem consulta ao banco por
 * requisição; mudança de papel vale a partir da próxima renovação (≤ 15 min).
 */
export class AccessTokenAuthenticator implements Authenticator {
  constructor(private readonly verifier: AccessTokenVerifier) {}

  async authenticate(authorizationHeader: string | undefined): Promise<AuthenticatedUser> {
    const token = BEARER.exec(authorizationHeader ?? '')?.[1];
    if (token === undefined) throw new InvalidTokenError();

    const claims = await this.verifier.verify(token);
    return {
      id: claims.userId,
      role: claims.role,
      permissions: Role.of(claims.role).permissions,
    };
  }
}
