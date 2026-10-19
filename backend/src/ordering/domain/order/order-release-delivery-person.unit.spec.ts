import { describe, expect, it } from 'vitest';

import { DeliveryPersonAssignmentNotAllowedError, DeliveryPersonUnassigned, type OrderStatusValue } from '..';
import { availableCourier, buildOrderIn, COURIER_ID, LATER } from './testing/order.fixture';

const RELEASED_AT = new Date('2025-01-20T15:40:00Z');

function assignedOrderIn(status: OrderStatusValue) {
  const order = buildOrderIn(status);
  order.assignDeliveryPerson(availableCourier(), LATER);
  order.pullDomainEvents();
  return order;
}

describe('Order.releaseDeliveryPerson (entregador desativado ou removido)', () => {
  it.each(['pending', 'preparing', 'ready'] satisfies OrderStatusValue[])(
    'pedido %s perde o entregador e volta para a atribuição',
    (status) => {
      const order = assignedOrderIn(status);

      order.releaseDeliveryPerson(RELEASED_AT);

      expect(order.deliveryPersonId).toBeNull();
      expect(order.status.value).toBe(status);
      expect(order.updatedAt).toEqual(RELEASED_AT);
      const events = order.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(DeliveryPersonUnassigned);
      expect(events[0]?.payload).toEqual({ previousDeliveryPersonId: COURIER_ID });
    },
  );

  it('sem entregador, não faz nada (pode ser chamado de novo)', () => {
    const order = buildOrderIn('ready');

    order.releaseDeliveryPerson(RELEASED_AT);

    expect(order.pullDomainEvents()).toEqual([]);
  });

  it.each(['delivering', 'delivered'] satisfies OrderStatusValue[])(
    'pedido %s já saiu: o entregador fica (a entrega continua com ele)',
    (status) => {
      const order = buildOrderIn(status);

      expect(() => order.releaseDeliveryPerson(RELEASED_AT)).toThrow(DeliveryPersonAssignmentNotAllowedError);
      expect(order.deliveryPersonId?.value).toBe(COURIER_ID);
    },
  );
});
