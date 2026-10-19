import { describe, expect, it } from 'vitest';

import {
  DeliveryPersonUnassigned,
  InvalidStatusTransitionError,
  OrderStatusChanged,
  ReturnReason,
  type OrderStatusValue,
} from '..';
import { availableCourier, buildOrderIn, COURIER_ID } from './testing/order.fixture';

const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const RETURNED_AT = new Date('2025-01-20T16:00:00Z');
const REASON = ReturnReason.create('Entregador sem contato há 30 minutos');

describe('Order.returnToAssignment (entrega devolvida pelo gestor)', () => {
  it('a entrega volta para ready, sem entregador, com o motivo no histórico', () => {
    const order = buildOrderIn('delivering');

    order.returnToAssignment(REASON, RETURNED_AT);

    expect(order.status.value).toBe('ready');
    expect(order.deliveryPersonId).toBeNull();
    expect(order.statusHistory.at(-1)).toMatchObject({
      from: 'delivering',
      to: 'ready',
      changedAt: RETURNED_AT,
      reason: 'Entregador sem contato há 30 minutos',
    });
    const events = order.pullDomainEvents();
    expect(events.map((event) => event.constructor)).toEqual([OrderStatusChanged, DeliveryPersonUnassigned]);
    expect(events[0]?.payload).toEqual({ from: 'delivering', to: 'ready', deliveryPersonId: null });
    expect(events[1]?.payload).toEqual({ previousDeliveryPersonId: COURIER_ID });
  });

  it('depois de devolvida, sai de novo com outro entregador (o histórico guarda as duas saídas)', () => {
    const order = buildOrderIn('delivering');
    order.returnToAssignment(REASON, RETURNED_AT);
    const other = availableCourier(OTHER_COURIER_ID);

    order.assignDeliveryPerson(other, RETURNED_AT);
    order.dispatch(other, RETURNED_AT);

    expect(order.status.value).toBe('delivering');
    expect(order.deliveryPersonId?.value).toBe(OTHER_COURIER_ID);
    expect(order.statusHistory.map((change) => change.to)).toEqual([
      'pending',
      'preparing',
      'ready',
      'delivering',
      'ready',
      'delivering',
    ]);
  });

  it.each(['pending', 'preparing', 'ready', 'delivered', 'cancelled'] satisfies OrderStatusValue[])(
    'pedido %s não está em entrega: recusa',
    (status) => {
      const order = buildOrderIn(status);

      expect(() => order.returnToAssignment(REASON, RETURNED_AT)).toThrow(InvalidStatusTransitionError);
      expect(order.status.value).toBe(status);
    },
  );

  it('a máquina de estados genérica continua sem delivering → ready (só por esta operação)', () => {
    const order = buildOrderIn('delivering');

    expect(order.status.allowedTransitions).not.toContain('ready');
  });
});
