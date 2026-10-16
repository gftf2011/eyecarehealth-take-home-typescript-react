import { InvalidTokenError, type Authenticator, type AuthenticatedUser } from '../../shared-kernel/presentation';

/**
 * PENDENTE: substituído pelo autenticador JWT quando o contexto Identity
 * tiver aplicação e infra. Até lá, nenhuma rota protegida é acessível — falhar
 * fechado é mais seguro que liberar sem autenticação.
 */
export class PendingIdentityAuthenticator implements Authenticator {
  async authenticate(): Promise<AuthenticatedUser> {
    throw new InvalidTokenError('Autenticação ainda não disponível');
  }
}
