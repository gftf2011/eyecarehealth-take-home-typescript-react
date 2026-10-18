import type { UseCase } from '../../../../shared-kernel/application';
import { toSessionDto, type SessionDto } from '../../dtos/session.dto';
import { parseLoginInput, type LoginInput } from '../../inputs/login.input';
import type { AuthGateway } from '../../ports/auth-gateway';
import type { SessionStore } from '../../ports/session-store';
import { startSession } from '../../sessions/start-session';

/**
 * Login por email e senha.
 *
 * - Valida os dois campos antes de chamar a API (um único `VALIDATION_ERROR`).
 * - Credenciais recusadas chegam como `UnauthenticatedError` (`INVALID_CREDENTIALS`)
 *   e excesso de tentativas como `RateLimitedError`; a sessão atual não muda.
 */
export class LoginUseCase implements UseCase<LoginInput, SessionDto> {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly sessions: SessionStore,
  ) {}

  async execute(input: LoginInput): Promise<SessionDto> {
    const { email, password } = parseLoginInput(input);

    const issued = await this.gateway.login({ email: email.value, password: password.value });
    const session = startSession(issued);

    this.sessions.authenticate(session);
    return toSessionDto(session);
  }
}
