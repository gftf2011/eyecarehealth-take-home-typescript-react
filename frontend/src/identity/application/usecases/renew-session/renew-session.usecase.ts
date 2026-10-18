import type { UseCase } from '../../../../shared-kernel/application';
import { AuthenticationError } from '../../../../shared-kernel/domain';
import { toSessionDto, type SessionDto } from '../../dtos/session.dto';
import type { AuthGateway } from '../../ports/auth-gateway';
import type { SessionRenewalLock } from '../../ports/session-renewal-lock';
import type { SessionStore } from '../../ports/session-store';
import { startSession } from '../../sessions/start-session';

/**
 * Renova o access token de uma sessão ativa (vencendo ou recusado pela API).
 *
 * - Refresh aceito: a sessão continua com o token novo.
 * - Refresh recusado (`401`): a sessão **expirou**; o painel volta ao login
 *   avisando o motivo.
 * - Falha de rede ou do servidor: a sessão é mantida (não é motivo para
 *   deslogar) e o erro sobe para a requisição que precisava do token.
 */
export class RenewSessionUseCase implements UseCase<void, SessionDto | null> {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly sessions: SessionStore,
    private readonly lock: SessionRenewalLock,
  ) {}

  async execute(): Promise<SessionDto | null> {
    if (this.sessions.state().status !== 'authenticated') return null;

    try {
      const issued = await this.lock.runExclusive(() => this.gateway.renew());
      // O usuário pode ter saído enquanto a renovação estava em andamento.
      if (this.sessions.state().status !== 'authenticated') return null;

      const session = startSession(issued);
      this.sessions.authenticate(session);
      return toSessionDto(session);
    } catch (error) {
      if (!(error instanceof AuthenticationError)) throw error;
      this.sessions.end('expired');
      return null;
    }
  }
}
