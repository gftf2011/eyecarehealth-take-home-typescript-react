import type { Clock, UseCase } from '../../../../shared-kernel/application';
import { InvalidRefreshTokenError } from '../../../domain';
import { toAuthenticatedUserDto, type AuthTokensDto } from '../../dtos/auth-tokens.dto';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work';
import type { RefreshTokenService } from '../../ports/refresh-token.service';
import type { TokenHasher } from '../../ports/token-hasher';
import type { AuthTokenFactory } from '../../services/auth-token.factory';

export type RefreshSessionInput = {
  readonly refreshToken: string | undefined;
};

type Outcome =
  | { readonly kind: 'rotated'; readonly tokens: AuthTokensDto }
  | { readonly kind: 'rejected'; readonly error: InvalidRefreshTokenError };

/**
 * Renova a sessão: troca o refresh token (rotação) e emite um novo access
 * token com o papel atual do usuário.
 */
export class RefreshSessionUseCase implements UseCase<RefreshSessionInput, AuthTokensDto> {
  constructor(
    private readonly unitOfWork: IdentityUnitOfWork,
    private readonly refreshTokens: RefreshTokenService,
    private readonly tokenHasher: TokenHasher,
    private readonly tokens: AuthTokenFactory,
    private readonly clock: Clock,
  ) {}

  async execute(input: RefreshSessionInput): Promise<AuthTokensDto> {
    if (input.refreshToken === undefined || input.refreshToken === '') {
      throw new InvalidRefreshTokenError('not-found');
    }
    const { sessionId } = await this.refreshTokens.verify(input.refreshToken);
    const presentedTokenHash = this.tokenHasher.hash(input.refreshToken);

    const outcome = await this.unitOfWork.transaction(async ({ users, sessions }): Promise<Outcome> => {
      const session = await sessions.findById(sessionId);
      if (session === null) throw new InvalidRefreshTokenError('not-found');

      const user = await users.findById(session.userId);
      if (user === null) throw new InvalidRefreshTokenError('not-found');

      const now = this.clock.now();
      const next = await this.tokens.refreshToken(sessionId, user.id, now);
      try {
        session.rotate({
          presentedTokenHash,
          nextTokenHash: next.hash,
          nextExpiresAt: next.expiresAt,
          now,
        });
      } catch (error) {
        if (error instanceof InvalidRefreshTokenError && error.reason === 'reuse-detected') {
          // A revogação precisa ser confirmada: o erro só é lançado após o commit.
          await sessions.save(session);
          return { kind: 'rejected', error };
        }
        throw error;
      }
      await sessions.save(session);

      const access = await this.tokens.accessToken(user, now);
      return {
        kind: 'rotated',
        tokens: {
          accessToken: access.token,
          accessTokenExpiresAt: access.expiresAt,
          refreshToken: next.token,
          refreshTokenExpiresAt: next.expiresAt,
          user: toAuthenticatedUserDto(user),
        },
      };
    });

    if (outcome.kind === 'rejected') throw outcome.error;
    return outcome.tokens;
  }
}
