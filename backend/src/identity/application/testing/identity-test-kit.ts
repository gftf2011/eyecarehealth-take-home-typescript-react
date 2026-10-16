import { FixedClock } from '../../../shared-kernel/application/testing/fixed-clock';
import { InMemoryRateLimitCounter } from '../../../shared-kernel/application/testing/in-memory-rate-limit.counter';
import { Email, Role, User, UserId, type RoleValue } from '../../domain';
import { Sha256TokenHasher } from '../../infra/security/sha256-token.hasher';
import { DEFAULT_AUTH_POLICY, type AuthPolicy } from '../config/auth-policy';
import { AuthTokenFactory } from '../services/auth-token.factory';
import { LoginUseCase } from '../usecases/login/login.usecase';
import { LogoutUseCase } from '../usecases/logout/logout.usecase';
import { RefreshSessionUseCase } from '../usecases/refresh-session/refresh-session.usecase';
import { FakeAccessTokenIssuer, FakePasswordHasher, FakeRefreshTokenService } from './fake-security';
import { InMemoryIdentityUnitOfWork } from './in-memory-identity-unit-of-work';

export const NOW = new Date('2025-03-01T10:00:00Z');
export const ADMIN_PASSWORD = 'Admin@123';

/** Monta os casos de uso do Identity com fakes compartilhados entre si. */
export function createIdentityTestKit(policy: AuthPolicy = DEFAULT_AUTH_POLICY) {
  const unitOfWork = new InMemoryIdentityUnitOfWork();
  const clock = new FixedClock(NOW);
  const passwordHasher = new FakePasswordHasher();
  const refreshTokens = new FakeRefreshTokenService();
  const tokenHasher = new Sha256TokenHasher();
  const loginAttempts = new InMemoryRateLimitCounter(() => clock.now().getTime());
  const tokens = new AuthTokenFactory(new FakeAccessTokenIssuer(), refreshTokens, tokenHasher, policy);

  const kit = {
    unitOfWork,
    clock,
    passwordHasher,
    tokenHasher,
    login: new LoginUseCase(unitOfWork, passwordHasher, tokens, loginAttempts, policy, clock),
    refresh: new RefreshSessionUseCase(unitOfWork, refreshTokens, tokenHasher, tokens, clock),
    logout: new LogoutUseCase(unitOfWork, refreshTokens, clock),

    async givenUser(email: string, password: string, role: RoleValue = 'admin'): Promise<User> {
      const user = User.register({
        id: UserId.generate(),
        email: Email.create(email),
        passwordHash: await passwordHasher.hash(password),
        role: Role.of(role),
        now: NOW,
      });
      unitOfWork.givenUsers(user);
      return user;
    },
  };
  return kit;
}
