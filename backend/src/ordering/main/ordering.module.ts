import type { Kysely } from 'kysely';

import type { Clock } from '../../shared-kernel/application';
import type { InMemoryEventMediator } from '../../shared-kernel/infra/events/in-memory-event-mediator';
import type { Route } from '../../shared-kernel/presentation';
import { AssignDeliveryPersonUseCase } from '../application/usecases/assign-delivery-person/assign-delivery-person.usecase';
import { ChangeOrderStatusUseCase } from '../application/usecases/change-order-status/change-order-status.usecase';
import { DispatchOrderUseCase } from '../application/usecases/dispatch-order/dispatch-order.usecase';
import { GetOrderUseCase } from '../application/usecases/get-order/get-order.usecase';
import { ListOrdersUseCase } from '../application/usecases/list-orders/list-orders.usecase';
import { PlaceOrderUseCase } from '../application/usecases/place-order/place-order.usecase';
import type { OrderingDatabase } from '../infra/persistence/schema/ordering-database';
import { KyselyOrderingUnitOfWork } from '../infra/persistence/unit-of-work/kysely-ordering-unit-of-work';
import { AssignDeliveryPersonController } from '../presentation/controllers/assign-delivery-person.controller';
import { ChangeOrderStatusController } from '../presentation/controllers/change-order-status.controller';
import { DispatchOrderController } from '../presentation/controllers/dispatch-order.controller';
import { GetOrderController } from '../presentation/controllers/get-order.controller';
import { ListOrdersController } from '../presentation/controllers/list-orders.controller';
import { PlaceOrderController } from '../presentation/controllers/place-order.controller';
import { assignDeliveryPersonRoute } from '../presentation/routes/assign-delivery-person.route';
import { changeOrderStatusRoute } from '../presentation/routes/change-order-status.route';
import { dispatchOrderRoute } from '../presentation/routes/dispatch-order.route';
import { getOrderRoute } from '../presentation/routes/get-order.route';
import { listOrdersRoute } from '../presentation/routes/list-orders.route';
import { placeOrderRoute } from '../presentation/routes/place-order.route';
import { OtelOrderingMetrics } from '../infra/observability/otel-ordering-metrics';
import { subscribeOrderingEventHandlers } from './ordering-event-handlers';

export type OrderingModuleDependencies = {
  readonly db: Kysely<OrderingDatabase>;
  readonly clock: Clock;
  /**
   * Mediador da aplicação. O módulo publica nele os eventos do Ordering e
   * também inscreve os próprios handlers (ex.: atualizações para o painel).
   */
  readonly events: InMemoryEventMediator;
};

/**
 * Composition root do Ordering: liga infra → casos de uso → controllers →
 * rotas e inscreve os handlers de eventos do contexto.
 */
export function makeOrderingRoutes({ db, clock, events }: OrderingModuleDependencies): Route[] {
  subscribeOrderingEventHandlers(events, new OtelOrderingMetrics());
  const unitOfWork = new KyselyOrderingUnitOfWork(db, events);

  return [
    listOrdersRoute(new ListOrdersController(new ListOrdersUseCase(unitOfWork))),
    getOrderRoute(new GetOrderController(new GetOrderUseCase(unitOfWork))),
    placeOrderRoute(new PlaceOrderController(new PlaceOrderUseCase(unitOfWork, clock))),
    changeOrderStatusRoute(
      new ChangeOrderStatusController(new ChangeOrderStatusUseCase(unitOfWork, clock)),
    ),
    assignDeliveryPersonRoute(
      new AssignDeliveryPersonController(new AssignDeliveryPersonUseCase(unitOfWork, clock)),
    ),
    dispatchOrderRoute(new DispatchOrderController(new DispatchOrderUseCase(unitOfWork, clock))),
  ];
}
