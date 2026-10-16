import {
  InputValidationError,
  validateInput,
  type Clock,
  type RateLimitCounter,
  type RateLimitHit,
  type UseCase,
} from '../../../../shared-kernel/application';
import {
  Email,
  InvalidCredentialsError,
  PasswordHash,
  RefreshSession,
  RefreshSessionId,
  type User,
} from '../../../domain';
import type { AuthPolicy } from '../../config/auth-policy';
import { toAuthenticatedUserDto, type AuthTokensDto } from '../../dtos/auth-tokens.dto';
import { TooManyLoginAttemptsError } from '../../errors/too-many-login-attempts.error';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work';
import type { PasswordHasher } from '../../ports/password-hasher';
import type { AuthTokenFactory } from '../../services/auth-token.factory';

/**
 * Hash bcrypt (custo 10) de uma senha descartável. Quando o email não existe,
 * a verificação roda contra ele para gastar o mesmo tempo de um usuário real:
 * o tempo de resposta não revela quais emails estão cadastrados.
 */
const TIMING_EQUALIZER_HASH = PasswordHash.fromHash(
  '$2b$10$tjuJ/QSPY5mR0vJ0AaDHt.pQy8dRh1Ccy24P/GGs.PW/wWEGVnL7u',
);

export type LoginInput = {
  readonly email: string;
  readonly password: string;
  /** IP do cliente, para limitar tentativas por (email, IP). */
  readonly ipAddress: string;
};

/** Autentica por email e senha e abre uma sessão com refresh token rotativo. */
export class LoginUseCase implements UseCase<LoginInput, AuthTokensDto> {
  constructor(
    private readonly unitOfWork: IdentityUnitOfWork,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: AuthTokenFactory,
    private readonly loginAttempts: RateLimitCounter,
    private readonly policy: AuthPolicy,
    private readonly clock: Clock,
  ) {}

  async execute(input: LoginInput): Promise<AuthTokensDto> {
    const { email } = validateInput({
      email: () => Email.create(input.email),
      password: () => ensurePasswordProvided(input.password),
    });

    const attemptsKey = `login:${email.value}:${input.ipAddress}`;
    await this.ensureNotBlocked(attemptsKey);

    // A transação só cobre a leitura: o bcrypt (~50ms) roda sem prender conexão.
    const user = await this.unitOfWork.transaction(({ users }) => users.findByEmail(email));
    const passwordMatches = await this.passwordHasher.verify(
      input.password,
      user?.passwordHash ?? TIMING_EQUALIZER_HASH,
    );
    if (user === null || !passwordMatches) {
      await this.recordFailure(attemptsKey);
      throw new InvalidCredentialsError();
    }

    return this.openSession(user);
  }

  private async openSession(user: User): Promise<AuthTokensDto> {
    const now = this.clock.now();
    const sessionId = RefreshSessionId.generate();
    const refresh = await this.tokens.refreshToken(sessionId, user.id, now);
    const access = await this.tokens.accessToken(user, now);

    const session = RefreshSession.start({
      id: sessionId,
      userId: user.id,
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      now,
    });
    await this.unitOfWork.transaction(({ sessions }) => sessions.save(session));

    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
      user: toAuthenticatedUserDto(user),
    };
  }

  /**
   * Só falhas contam: quem acerta a senha nunca é bloqueado por entrar várias
   * vezes. Atingido o limite de falhas na janela, nem a senha certa é aceita
   * até a janela expirar. Se o contador estiver fora do ar, o login segue
   * (fail-open): indisponibilidade do Redis não pode impedir todos de entrar.
   */
  private async ensureNotBlocked(key: string): Promise<void> {
    let failures: RateLimitHit;
    try {
      failures = await this.loginAttempts.peek(key);
    } catch {
      return;
    }
    if (failures.count >= this.policy.loginAttempts.max) {
      throw new TooManyLoginAttemptsError(Math.ceil(failures.ttlMs / 1000));
    }
  }

  private async recordFailure(key: string): Promise<void> {
    try {
      await this.loginAttempts.hit(key, this.policy.loginAttempts.windowMs);
    } catch {
      // fail-open: ver ensureNotBlocked.
    }
  }
}

function ensurePasswordProvided(password: string): string {
  if (password.length === 0) {
    throw new InputValidationError([{ field: 'password', message: 'Informe a senha' }]);
  }
  return password;
}
