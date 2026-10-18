import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, type DataRouter } from 'react-router';

import { IdentityProvider } from '../../identity/presentation';
import type { AppDependencies } from './create-app-dependencies';

/** Raiz do painel: cache de consultas, serviços dos contextos e rotas. */
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
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>
  );
}
