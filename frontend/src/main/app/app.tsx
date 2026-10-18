import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, type DataRouter } from 'react-router';

import { IdentityProvider, SessionPermissions } from '../../identity/presentation';
import { OrderingProvider } from '../../ordering/presentation';
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
          <OrderingProvider services={dependencies.ordering.services}>
            <RouterProvider router={router} />
          </OrderingProvider>
        </SessionPermissions>
      </IdentityProvider>
    </QueryClientProvider>
  );
}
