import type { QueryClient } from '@tanstack/react-query';

import { createIdentityModule, type IdentityModule } from '../../identity/main/identity.module';
import type { SessionRenewalSchedulerOptions } from '../../identity/infra';
import { FetchHttpClient, SystemClock } from '../../shared-kernel/infra';
import type { AppConfig } from '../config/app-config';
import { createQueryClient } from './create-query-client';

export type AppDependencies = {
  readonly identity: IdentityModule;
  /** Cliente das rotas autenticadas, compartilhado pelos contextos de negócio. */
  readonly api: FetchHttpClient;
  readonly queryClient: QueryClient;
};

export type AppDependenciesOptions = AppConfig & {
  readonly fetch?: typeof globalThis.fetch;
  readonly locks?: LockManager;
  readonly renewal?: SessionRenewalSchedulerOptions;
};

/** Composition root do painel: monta cada contexto e liga o token do Identity ao cliente HTTP. */
export function createAppDependencies(options: AppDependenciesOptions): AppDependencies {
  const clock = new SystemClock();
  const identity = createIdentityModule({
    apiBaseUrl: options.apiBaseUrl,
    clock,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.locks === undefined ? {} : { locks: options.locks }),
    ...(options.renewal === undefined ? {} : { renewal: options.renewal }),
  });

  const api = new FetchHttpClient({
    baseUrl: options.apiBaseUrl,
    accessTokens: identity.accessTokens,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });

  return { identity, api, queryClient: createQueryClient() };
}
