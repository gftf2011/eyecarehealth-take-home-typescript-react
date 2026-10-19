import { beforeEach, describe, expect, it } from 'vitest';

import type { EventHandlingScope } from '../../../shared-kernel/application';
import type { DomainEvent } from '../../../shared-kernel/domain';
import { InMemoryEventMediator } from '../../../shared-kernel/infra/events/in-memory-event-mediator';
import { Order, OrderStatus } from '../../domain';
import { buildOrderIn, buildPlaceOrderParams, LATER } from '../../domain/order/testing/order.fixture';
import { subscribeOrderingEventHandlers } from '../../main/ordering-event-handlers';
import { RecordingOrderingMetrics } from '../testing/recording-ordering-metrics';

describe('RecordOrderMetricsHandler', () => {
  let metrics: RecordingOrderingMetrics;
  let effects: (() => void)[];
  let scope: EventHandlingScope;
  let mediator: InMemoryEventMediator;

  beforeEach(() => {
    metrics = new RecordingOrderingMetrics();
    effects = [];
    scope = { outbox: { append: async () => undefined }, afterCommit: (effect) => effects.push(effect) };
    mediator = new InMemoryEventMediator();
    subscribeOrderingEventHandlers(mediator, metrics);
  });

  async function publish(events: readonly DomainEvent[]): Promise<void> {
    await mediator.publish(events, scope);
  }

  const commit = (): void => {
    for (const effect of effects) effect();
  };

  it('pedido criado só conta depois do commit', async () => {
    await publish(Order.place(buildPlaceOrderParams()).pullDomainEvents());

    expect(metrics.placed).toBe(0);
    commit();
    expect(metrics.placed).toBe(1);
  });

  it('transação desfeita (efeitos descartados) não entra na métrica', async () => {
    await publish(Order.place(buildPlaceOrderParams()).pullDomainEvents());

    effects = [];

    expect(metrics.placed).toBe(0);
  });

  it('registra a transição com o status de origem e de destino', async () => {
    const order = buildOrderIn('pending');
    order.changeStatus(OrderStatus.of('preparing'), LATER);

    await publish(order.pullDomainEvents());
    commit();

    expect(metrics.transitions).toEqual([{ from: 'pending', to: 'preparing' }]);
  });
});
