import type { Clock } from '../../shared-kernel/application';
import { FetchHttpClient, type AccessTokenProvider } from '../../shared-kernel/infra';
import {
  LoginUseCase,
  LogoutUseCase,
  RenewSessionUseCase,
  RestoreSessionUseCase,
  type SessionStore,
} from '../application';
import {
  HttpAuthGateway,
  InMemorySessionStore,
  SessionAccessTokenProvider,
  SessionRenewalScheduler,
  WebLocksSessionRenewalLock,
  type SessionRenewalSchedulerOptions,
} from '../infra';
import type { IdentityServices } from '../presentation';

export type IdentityModuleOptions = {
  readonly apiBaseUrl: string;
  readonly clock: Clock;
  readonly fetch?: typeof globalThis.fetch;
  readonly locks?: LockManager;
  readonly renewal?: SessionRenewalSchedulerOptions;
};

export type IdentityModule = {
  readonly services: IdentityServices;
  readonly sessions: SessionStore;
  /** Fornece o access token aos clientes HTTP dos outros contextos. */
  readonly accessTokens: AccessTokenProvider;
  /** Restaura a sessão pelo cookie e passa a renová-la antes de vencer. */
  start(): Promise<void>;
  stop(): void;
};

/** Composition root do Identity. */
export function createIdentityModule(options: IdentityModuleOptions): IdentityModule {
  // Rotas de autenticação: sem provider de token (a renovação não pode renovar a si mesma).
  const authHttp = new FetchHttpClient({
    baseUrl: options.apiBaseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  const gateway = new HttpAuthGateway(authHttp);
  const sessions = new InMemorySessionStore();
  const lock = new WebLocksSessionRenewalLock(options.locks ?? globalThis.navigator?.locks);

  const accessTokens = new SessionAccessTokenProvider(
    sessions,
    new RenewSessionUseCase(gateway, sessions, lock),
    options.clock,
  );
  const scheduler = new SessionRenewalScheduler(sessions, accessTokens, options.clock, options.renewal);
  const restoreSession = new RestoreSessionUseCase(gateway, sessions, lock);

  return {
    services: {
      login: new LoginUseCase(gateway, sessions),
      logout: new LogoutUseCase(gateway, sessions),
      sessions,
    },
    sessions,
    accessTokens,
    async start() {
      scheduler.start();
      try {
        await restoreSession.execute();
      } catch {
        // API fora do ar ao abrir: o painel segue anônimo e o login mostra o erro ao tentar entrar.
      }
    },
    stop() {
      scheduler.stop();
    },
  };
}
