import { describe, expect, it } from 'vitest';

import type { LiveEvent } from '../../../shared-kernel/application';
import type { MyDeliveries } from '../../domain';
import { myDeliveriesAffectedBy } from './use-my-deliveries-live-updates';

const ME = 'courier-1';
const delivery = (orderId: string) => ({
  orderId,
  status: 'ready' as const,
  customerName: 'João Silva',
  customerPhone: '(11) 99999-1234',
  deliveryAddress: 'Rua das Flores, 123',
  latitude: -23.5,
  longitude: -46.6,
  items: [],
  totalCents: 1000,
  openIssue: null,
  createdAt: new Date('2026-10-19T12:00:00Z'),
});
const current: MyDeliveries = { courier: { id: ME, name: 'Carlos Santos' }, inProgress: null, upcoming: [delivery('o-mine')] };

const orderEvent = (payload: Record<string, unknown>): LiveEvent => ({
  id: 'e1',
  topic: 'ordering.order-updates',
  occurredAt: '2026-10-19T12:00:00.000Z',
  payload,
});

describe('myDeliveriesAffectedBy', () => {
  it.each([
    ['pedido despachado para mim', orderEvent({ type: 'order.status-changed', orderId: 'o-new', status: 'delivering', deliveryPersonId: ME }), true],
    ['pedido atribuído a mim', orderEvent({ type: 'order.delivery-person-assigned', orderId: 'o-new', deliveryPersonId: ME }), true],
    ['pedido tirado de mim', orderEvent({ type: 'order.delivery-person-unassigned', orderId: 'o-x', previousDeliveryPersonId: ME }), true],
    ['um pedido que está na minha tela mudou', orderEvent({ type: 'order.status-changed', orderId: 'o-mine', status: 'cancelled', deliveryPersonId: null }), true],
    ['o gestor decidiu sobre o meu problema', orderEvent({ type: 'order.delivery-issue-resolved', orderId: 'o-x', resolution: 'retried', deliveryPersonId: ME }), true],
    ['pedido de outro entregador', orderEvent({ type: 'order.status-changed', orderId: 'o-other', status: 'delivering', deliveryPersonId: 'courier-2' }), false],
    ['pedido novo de um cliente', orderEvent({ type: 'order.placed', orderId: 'o-new', status: 'pending' }), false],
  ])('%s → %s', (_, event, affected) => {
    expect(myDeliveriesAffectedBy(event, current)).toBe(affected);
  });

  it('mudança no meu cadastro conta; no de outro, não', () => {
    const fleet = (deliveryPersonId: string): LiveEvent => ({
      id: 'e2',
      topic: 'delivery.delivery-person-updates',
      occurredAt: '2026-10-19T12:00:00.000Z',
      payload: { type: 'delivery-person.activation-changed', deliveryPersonId, isActive: false },
    });

    expect(myDeliveriesAffectedBy(fleet(ME), current)).toBe(true);
    expect(myDeliveriesAffectedBy(fleet('courier-2'), current)).toBe(false);
  });

  it('antes de a tela carregar, qualquer evento conta', () => {
    expect(myDeliveriesAffectedBy(orderEvent({ type: 'order.placed', orderId: 'x' }), undefined)).toBe(true);
  });
});
