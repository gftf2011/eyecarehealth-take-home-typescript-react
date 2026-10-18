import type { QueryClient } from '@tanstack/react-query';

import { createCatalogModule, type CatalogModule } from '../../catalog/main/catalog.module';
import { createDeliveryModule, type DeliveryModule } from '../../delivery/main/delivery.module';
import type { SessionRenewalSchedulerOptions } from '../../identity/infra';
import { createIdentityModule, type IdentityModule } from '../../identity/main/identity.module';
import { createOrderingModule, type OrderingModule } from '../../ordering/main/ordering.module';
import { FetchHttpClient, SystemClock } from '../../shared-kernel/infra';
import type { AppConfig } from '../config/app-config';
import { createQueryClient } from './create-query-client';

export type AppDependencies = {
  readonly identity: IdentityModule;
  readonly catalog: CatalogModule;
  readonly delivery: DeliveryModule;
  readonly ordering: OrderingModule;
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

  // Cliente das rotas autenticadas, compartilhado pelos contextos de negócio.
  const api = new FetchHttpClient({
    baseUrl: options.apiBaseUrl,
    accessTokens: identity.accessTokens,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });

  return {
    identity,
    catalog: createCatalogModule(api),
    delivery: createDeliveryModule(api),
    ordering: createOrderingModule(api),
    queryClient: createQueryClient(),
  };
}
