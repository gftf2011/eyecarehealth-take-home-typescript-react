import { InvalidTokenError } from '../../../shared-kernel/application';
import type {
  AuthenticatedUser,
  Authenticator,
  TokenAuthenticator,
  TokenPrincipal,
} from '../../../shared-kernel/presentation';
import type { AccessTokenVerifier } from '../../application/ports/access-token.service';
import { Role } from '../../domain';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Autenticador real: verifica o JWT de acesso e deriva as permissões do
 * papel. Sem consulta ao banco por requisição; mudança de papel vale a partir
 * da próxima renovação (≤ 15 min).
 *
 * - API: lê `Authorization: Bearer <access token>`.
 * - Tempo real: recebe o token já extraído e devolve também a expiração, para
 *   o gateway encerrar a conexão quando o token vencer.
 */
export class AccessTokenAuthenticator implements Authenticator, TokenAuthenticator {
  constructor(private readonly verifier: AccessTokenVerifier) {}

  async authenticate(authorizationHeader: string | undefined): Promise<AuthenticatedUser> {
    const token = BEARER.exec(authorizationHeader ?? '')?.[1];
    if (token === undefined) throw new InvalidTokenError();

    const { expiresAt: _expiresAt, ...user } = await this.authenticateToken(token);
    return user;
  }

  async authenticateToken(accessToken: string): Promise<TokenPrincipal> {
    if (accessToken.trim() === '') throw new InvalidTokenError();

    const claims = await this.verifier.verify(accessToken);
    return {
      id: claims.userId,
      role: claims.role,
      permissions: Role.of(claims.role).permissions,
      expiresAt: claims.expiresAt,
    };
  }
}
