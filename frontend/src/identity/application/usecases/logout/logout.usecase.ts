import type { UseCase } from '../../../../shared-kernel/application';
import { DomainError } from '../../../../shared-kernel/domain';
import type { AuthGateway } from '../../ports/auth-gateway';
import type { SessionStore } from '../../ports/session-store';

/**
 * Encerra a sessão. A sessão local acaba mesmo se a API não responder: o
 * usuário pediu para sair e a tela não pode continuar logada. A revogação no
 * servidor é a melhor tentativa; se falhar, o cookie expira sozinho.
 */
export class LogoutUseCase implements UseCase<void, void> {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly sessions: SessionStore,
  ) {}

  async execute(): Promise<void> {
    try {
      await this.gateway.logout();
    } catch (error) {
      // Falhas conhecidas (rede, sessão já revogada) não impedem a saída; bugs sobem.
      if (!(error instanceof DomainError)) throw error;
    } finally {
      this.sessions.end('signed-out');
    }
  }
}
