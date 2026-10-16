import type { Clock, UseCase } from '../../../../shared-kernel/application';
import { InvalidRefreshTokenError } from '../../../domain';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work';
import type { RefreshTokenClaims, RefreshTokenService } from '../../ports/refresh-token.service';

export type LogoutInput = {
  readonly refreshToken: string | undefined;
};

/**
 * Encerra a sessão do refresh token. É idempotente e silencioso: token
 * ausente, inválido ou já revogado não é erro — o resultado (sessão
 * encerrada) é o mesmo.
 */
export class LogoutUseCase implements UseCase<LogoutInput, void> {
  constructor(
    private readonly unitOfWork: IdentityUnitOfWork,
    private readonly refreshTokens: RefreshTokenService,
    private readonly clock: Clock,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    if (input.refreshToken === undefined || input.refreshToken === '') return;

    let claims: RefreshTokenClaims;
    try {
      claims = await this.refreshTokens.verify(input.refreshToken);
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) return;
      throw error;
    }

    await this.unitOfWork.transaction(async ({ sessions }) => {
      const session = await sessions.findById(claims.sessionId);
      if (session === null || session.isRevoked) return;
      session.revoke('logout', this.clock.now());
      await sessions.save(session);
    });
  }
}
