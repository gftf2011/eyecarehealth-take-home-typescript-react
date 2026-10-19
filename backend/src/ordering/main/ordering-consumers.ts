import type { Kysely } from 'kysely';

import type { Clock } from '../../shared-kernel/application';
import type { InMemoryEventMediator } from '../../shared-kernel/infra/events/in-memory-event-mediator';
import { ReleaseDeliveryPersonOrdersUseCase } from '../application/usecases/release-delivery-person-orders/release-delivery-person-orders.usecase';
import { OtelOrderingMetrics } from '../infra/observability/otel-ordering-metrics';
import type { OrderingDatabase } from '../infra/persistence/schema/ordering-database';
import { KyselyOrderingUnitOfWork } from '../infra/persistence/unit-of-work/kysely-ordering-unit-of-work';
import { DeliveryPersonUpdatesConsumer } from '../presentation/consumers/delivery-person-updates.consumer';
import { subscribeOrderingEventHandlers } from './ordering-event-handlers';

export type OrderingConsumersDependencies = {
  readonly db: Kysely<OrderingDatabase>;
  readonly clock: Clock;
  /** Mediador do processo: os eventos dos pedidos alterados chegam ao outbox por ele. */
  readonly events: InMemoryEventMediator;
};

export type OrderingConsumers = {
  readonly deliveryPersonUpdates: DeliveryPersonUpdatesConsumer;
};

/**
 * Composition root dos consumidores de mensagens do Ordering (o processo
 * `event-consumers`, separado da API). Inscreve os handlers do contexto: um
 * pedido que perde o entregador também avisa o painel pelo outbox.
 */
export function makeOrderingConsumers({ db, clock, events }: OrderingConsumersDependencies): OrderingConsumers {
  subscribeOrderingEventHandlers(events, new OtelOrderingMetrics());
  const unitOfWork = new KyselyOrderingUnitOfWork(db, events);
  return {
    deliveryPersonUpdates: new DeliveryPersonUpdatesConsumer(new ReleaseDeliveryPersonOrdersUseCase(unitOfWork, clock)),
  };
}
