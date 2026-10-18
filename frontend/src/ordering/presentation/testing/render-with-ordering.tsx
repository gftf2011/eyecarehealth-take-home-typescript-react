import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { PERMISSIONS, type Permission } from '../../../shared-kernel/domain';
import { PermissionsProvider } from '../../../shared-kernel/presentation';
import { ChangeOrderStatusUseCase, GetOrderUseCase, ListOrdersUseCase } from '../../application';
import { FakeOrderGateway } from '../../application/testing/fake-order.gateway';
import { OrderingProvider } from '../providers/ordering-provider';

/** Renderiza um componente de pedidos com casos de uso reais sobre um gateway em memória. */
export function renderWithOrdering(
  ui: ReactNode,
  options: { readonly permissions?: readonly Permission[]; readonly gateway?: FakeOrderGateway } = {},
) {
  const gateway = options.gateway ?? new FakeOrderGateway();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const services = {
    listOrders: new ListOrdersUseCase(gateway),
    getOrder: new GetOrderUseCase(gateway),
    changeOrderStatus: new ChangeOrderStatusUseCase(gateway),
  };

  const view = render(
    <QueryClientProvider client={queryClient}>
      <PermissionsProvider permissions={options.permissions ?? PERMISSIONS}>
        <OrderingProvider services={services}>{ui}</OrderingProvider>
      </PermissionsProvider>
    </QueryClientProvider>,
  );
  return { ...view, gateway, queryClient, user: userEvent.setup() };
}
