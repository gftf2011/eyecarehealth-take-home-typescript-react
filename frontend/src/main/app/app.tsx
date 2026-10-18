import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, type DataRouter } from 'react-router';

import { CatalogProvider } from '../../catalog/presentation';
import { DeliveryProvider } from '../../delivery/presentation';
import { IdentityProvider, SessionPermissions } from '../../identity/presentation';
import { OrderingProvider } from '../../ordering/presentation';
import { ReportingProvider } from '../../reporting/presentation';
import type { AppDependencies } from './create-app-dependencies';

/** Raiz do painel: cache de consultas, serviços dos contextos, permissões da sessão e rotas. */
export function App({
  dependencies,
  router,
}: {
  readonly dependencies: AppDependencies;
  readonly router: DataRouter;
}) {
  return (
    <QueryClientProvider client={dependencies.queryClient}>
      <IdentityProvider services={dependencies.identity.services}>
        <SessionPermissions>
          <CatalogProvider services={dependencies.catalog.services}>
            <OrderingProvider services={dependencies.ordering.services}>
              <DeliveryProvider services={dependencies.delivery.services}>
                <ReportingProvider services={dependencies.reporting.services}>
                  <RouterProvider router={router} />
                </ReportingProvider>
              </DeliveryProvider>
            </OrderingProvider>
          </CatalogProvider>
        </SessionPermissions>
      </IdentityProvider>
    </QueryClientProvider>
  );
}
