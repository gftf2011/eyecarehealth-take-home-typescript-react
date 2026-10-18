import type { FetchHttpClient } from '../../shared-kernel/infra';
import { ChangeOrderStatusUseCase, GetOrderUseCase, ListOrdersUseCase } from '../application';
import { HttpOrderGateway } from '../infra';
import type { OrderingServices } from '../presentation';

export type OrderingModule = {
  readonly services: OrderingServices;
};

/** Composition root do Ordering: recebe o cliente HTTP autenticado do painel. */
export function createOrderingModule(api: FetchHttpClient): OrderingModule {
  const orders = new HttpOrderGateway(api);
  return {
    services: {
      listOrders: new ListOrdersUseCase(orders),
      getOrder: new GetOrderUseCase(orders),
      changeOrderStatus: new ChangeOrderStatusUseCase(orders),
    },
  };
}
