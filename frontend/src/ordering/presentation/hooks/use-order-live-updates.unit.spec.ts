import { describe, expect, it } from 'vitest';

import type { LiveEvent } from '../../../shared-kernel/application';
import { orderQueryKeys } from '../queries/order-query-keys';
import { ORDER_UPDATES_TOPIC, orderDetailAffectedBy, orderListAffectedBy } from './use-order-live-updates';

const event = (payload: Record<string, unknown>): LiveEvent => ({
  id: 'e1',
  topic: ORDER_UPDATES_TOPIC,
  occurredAt: '2026-10-18T12:00:00.000Z',
  payload,
});

const placed = event({ type: 'order.placed', orderId: 'o1', status: 'pending' });
const delivered = event({ type: 'order.status-changed', orderId: 'o1', previousStatus: 'delivering', status: 'delivered' });
const courierSwap = event({ type: 'order.delivery-person-assigned', orderId: 'o1', deliveryPersonId: 'd1' });

describe('orderListAffectedBy', () => {
  it('sem filtro de status, todo evento conta', () => {
    expect(orderListAffectedBy(placed, orderQueryKeys.list({ cursor: 'abc' }))).toBe(true);
  });

  it('com filtro, só o pedido que entra no status ou sai dele', () => {
    expect(orderListAffectedBy(placed, orderQueryKeys.list({ status: 'delivered' }))).toBe(false);
    expect(orderListAffectedBy(delivered, orderQueryKeys.list({ status: 'delivered' }))).toBe(true);
    expect(orderListAffectedBy(delivered, orderQueryKeys.list({ status: 'delivering' }))).toBe(true);
    expect(orderListAffectedBy(delivered, orderQueryKeys.list({ status: 'pending' }))).toBe(false);
  });

  it('evento sem status (troca de entregador) não pode ser descartado', () => {
    expect(orderListAffectedBy(courierSwap, orderQueryKeys.list({ status: 'ready' }))).toBe(true);
  });

  it('filtro vazio é o mesmo que sem filtro', () => {
    expect(orderListAffectedBy(placed, orderQueryKeys.list({ status: '  ' }))).toBe(true);
  });
});

describe('orderDetailAffectedBy', () => {
  it('só o detalhe do próprio pedido', () => {
    expect(orderDetailAffectedBy(delivered, orderQueryKeys.detail('o1'))).toBe(true);
    expect(orderDetailAffectedBy(delivered, orderQueryKeys.detail('o2'))).toBe(false);
  });
});
