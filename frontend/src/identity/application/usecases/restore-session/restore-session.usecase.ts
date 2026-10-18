import type { UseCase } from '../../../../shared-kernel/application';
import { AuthenticationError } from '../../../../shared-kernel/domain';
import { toSessionDto, type SessionDto } from '../../dtos/session.dto';
import type { AuthGateway } from '../../ports/auth-gateway';
import type { SessionRenewalLock } from '../../ports/session-renewal-lock';
import type { SessionStore } from '../../ports/session-store';
import { startSession } from '../../sessions/start-session';

/**
 * Ao abrir (ou recarregar) o painel, recupera a sessão pelo cookie de
 * refresh: o access token não sobrevive ao reload porque fica só em memória.
 *
 * - Cookie válido: sessão autenticada.
 * - Sem cookie ou recusado (`401`): visitante anônimo, sem aviso de expiração.
 * - Falha de rede ou do servidor: anônimo, e o erro sobe para a interface avisar.
 */
export class RestoreSessionUseCase implements UseCase<void, SessionDto | null> {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly sessions: SessionStore,
    private readonly lock: SessionRenewalLock,
  ) {}

  async execute(): Promise<SessionDto | null> {
    try {
      const issued = await this.lock.runExclusive(() => this.gateway.renew());
      const session = startSession(issued);
      this.sessions.authenticate(session);
      return toSessionDto(session);
    } catch (error) {
      this.sessions.end(null);
      if (error instanceof AuthenticationError) return null;
      throw error;
    }
  }
}
