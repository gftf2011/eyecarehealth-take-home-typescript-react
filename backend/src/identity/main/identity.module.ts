import type { Kysely } from 'kysely';

import type { Clock, EventMediator, RateLimitCounter } from '../../shared-kernel/application';
import type { Authenticator, Route } from '../../shared-kernel/presentation';
import type { AuthPolicy } from '../application/config/auth-policy';
import type { PasswordHasher } from '../application/ports/password-hasher';
import { AuthTokenFactory } from '../application/services/auth-token.factory';
import { LoginUseCase } from '../application/usecases/login/login.usecase';
import { LogoutUseCase } from '../application/usecases/logout/logout.usecase';
import { RefreshSessionUseCase } from '../application/usecases/refresh-session/refresh-session.usecase';
import type { IdentityDatabase } from '../infra/persistence/schema/identity-database';
import { KyselyIdentityUnitOfWork } from '../infra/persistence/unit-of-work/kysely-identity-unit-of-work';
import { BcryptPasswordHasher } from '../infra/security/bcrypt-password.hasher';
import { JoseAccessTokenService } from '../infra/security/jose-access-token.service';
import { JoseRefreshTokenService } from '../infra/security/jose-refresh-token.service';
import { Sha256TokenHasher } from '../infra/security/sha256-token.hasher';
import { AccessTokenAuthenticator } from '../presentation/auth/access-token.authenticator';
import { LoginController } from '../presentation/controllers/login.controller';
import { LogoutController } from '../presentation/controllers/logout.controller';
import { RefreshSessionController } from '../presentation/controllers/refresh-session.controller';
import { RefreshTokenCookie } from '../presentation/cookies/refresh-token.cookie';
import { loginRoute } from '../presentation/routes/login.route';
import { logoutRoute } from '../presentation/routes/logout.route';
import { refreshSessionRoute } from '../presentation/routes/refresh-session.route';

export type IdentityModuleDependencies = {
  readonly db: Kysely<IdentityDatabase>;
  readonly clock: Clock;
  /** Recebe os eventos de domínio do Identity e os entrega aos handlers inscritos. */
  readonly events: EventMediator;
  readonly secrets: { readonly accessToken: string; readonly refreshToken: string };
  readonly policy: AuthPolicy;
  readonly bcryptCost: number;
  /** `false` só em desenvolvimento local sem HTTPS. */
  readonly secureCookies: boolean;
  /** Contador das tentativas de login (Redis em produção). */
  readonly loginAttempts: RateLimitCounter;
};

export type IdentityModule = {
  readonly routes: Route[];
  /** Autenticador JWT usado por todas as rotas protegidas da API. */
  readonly authenticator: Authenticator;
  readonly passwordHasher: PasswordHasher;
};

/** Composition root do Identity. */
export function makeIdentityModule(deps: IdentityModuleDependencies): IdentityModule {
  const unitOfWork = new KyselyIdentityUnitOfWork(deps.db, deps.events);
  const passwordHasher = new BcryptPasswordHasher(deps.bcryptCost);
  const accessTokens = new JoseAccessTokenService(deps.secrets.accessToken, deps.clock);
  const refreshTokens = new JoseRefreshTokenService(deps.secrets.refreshToken, deps.clock);
  const tokenHasher = new Sha256TokenHasher();
  const tokens = new AuthTokenFactory(accessTokens, refreshTokens, tokenHasher, deps.policy);
  const cookie = new RefreshTokenCookie(deps.secureCookies);

  const login = new LoginUseCase(
    unitOfWork,
    passwordHasher,
    tokens,
    deps.loginAttempts,
    deps.policy,
    deps.clock,
  );
  const refresh = new RefreshSessionUseCase(unitOfWork, refreshTokens, tokenHasher, tokens, deps.clock);
  const logout = new LogoutUseCase(unitOfWork, refreshTokens, deps.clock);

  return {
    routes: [
      loginRoute(new LoginController(login, cookie)),
      refreshSessionRoute(new RefreshSessionController(refresh, cookie)),
      logoutRoute(new LogoutController(logout, cookie)),
    ],
    authenticator: new AccessTokenAuthenticator(accessTokens),
    passwordHasher,
  };
}
