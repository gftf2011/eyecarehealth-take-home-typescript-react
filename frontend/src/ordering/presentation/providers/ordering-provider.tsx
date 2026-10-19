import { createContext, use, type ReactNode } from 'react';

import type { Page, UseCase } from '../../../shared-kernel/application';
import type {
  ChangeOrderStatusInput,
  GetOrderInput,
  ListOrdersInput,
  OrderDto,
  RequestOptions,
  ResolveDeliveryIssueInput,
  ReturnOrderToAssignmentInput,
} from '../../application';

/** Casos de uso que as telas de pedidos usam. */
export type OrderingServices = {
  readonly listOrders: UseCase<ListOrdersInput & RequestOptions, Page<OrderDto>>;
  readonly getOrder: UseCase<GetOrderInput, OrderDto>;
  readonly changeOrderStatus: UseCase<ChangeOrderStatusInput, OrderDto>;
  readonly returnOrderToAssignment: UseCase<ReturnOrderToAssignmentInput, OrderDto>;
  readonly resolveDeliveryIssue: UseCase<ResolveDeliveryIssueInput, OrderDto>;
};

const OrderingContext = createContext<OrderingServices | null>(null);

export function OrderingProvider({
  services,
  children,
}: {
  readonly services: OrderingServices;
  readonly children: ReactNode;
}) {
  return <OrderingContext value={services}>{children}</OrderingContext>;
}

export function useOrderingServices(): OrderingServices {
  const services = use(OrderingContext);
  if (services === null) throw new Error('useOrderingServices precisa estar dentro de <OrderingProvider>');
  return services;
}
