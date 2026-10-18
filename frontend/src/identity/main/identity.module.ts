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

/** Token da sessão para quem não fala HTTP (ex.: o WebSocket do tempo real). */
export type SessionTokens = {
  current(): Promise<string | null>;
  renew(): Promise<string | null>;
  subscribe(listener: (token: string | null) => void): () => void;
};

export type IdentityModule = {
  readonly services: IdentityServices;
  readonly sessions: SessionStore;
  /** Fornece o access token aos clientes HTTP dos outros contextos. */
  readonly accessTokens: AccessTokenProvider;
  /** Token atual, renovação e mudanças (login, renovação, fim da sessão). */
  readonly tokens: SessionTokens;
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

  const tokenOf = (): string | null => {
    const state = sessions.state();
    return state.status === 'authenticated' ? state.session.accessToken : null;
  };

  return {
    services: {
      login: new LoginUseCase(gateway, sessions),
      logout: new LogoutUseCase(gateway, sessions),
      sessions,
    },
    sessions,
    accessTokens,
    tokens: {
      current: () => accessTokens.currentToken(),
      renew: () => accessTokens.renewNow(),
      subscribe: (listener) => {
        let last = tokenOf();
        return sessions.subscribe(() => {
          const token = tokenOf();
          if (token === last) return;
          last = token;
          listener(token);
        });
      },
    },
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
