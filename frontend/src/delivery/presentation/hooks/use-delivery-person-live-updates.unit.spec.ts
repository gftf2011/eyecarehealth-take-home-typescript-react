import { describe, expect, it } from 'vitest';

import type { LiveEvent } from '../../../shared-kernel/application';
import { deliveryPersonListAffectedBy } from './use-delivery-person-live-updates';

const event = (payload: Record<string, unknown>): LiveEvent => ({
  id: 'e1',
  topic: 'ordering.order-updates',
  occurredAt: '2026-10-18T12:00:00.000Z',
  payload,
});
const changed = (previousStatus: string, status: string) =>
  event({ type: 'order.status-changed', orderId: 'o1', previousStatus, status });

describe('deliveryPersonListAffectedBy (eventos de pedido)', () => {
  it.each([
    ['despacho deixa o entregador em entrega', changed('ready', 'delivering'), true],
    ['entrega concluída libera o entregador', changed('delivering', 'delivered'), true],
    ['entrega cancelada libera o entregador', changed('delivering', 'cancelled'), true],
    ['pedido ficou pronto', changed('preparing', 'ready'), false],
    ['pedido novo', event({ type: 'order.placed', orderId: 'o1', status: 'pending' }), false],
    ['entregador atribuído a um pedido pronto', event({ type: 'order.delivery-person-assigned', orderId: 'o1' }), false],
    ['pedido pronto perdeu o entregador desativado', event({ type: 'order.delivery-person-unassigned', orderId: 'o1' }), false],
    ['problema relatado na entrega', event({ type: 'order.delivery-issue-reported', orderId: 'o1', deliveryPersonId: 'c1' }), false],
    ['problema resolvido (tentar de novo)', event({ type: 'order.delivery-issue-resolved', orderId: 'o1', resolution: 'retried' }), false],
    ['tipo desconhecido, na dúvida recarrega', event({ type: 'order.algo-novo', orderId: 'o1' }), true],
  ])('%s → %s', (_, liveEvent, affected) => {
    expect(deliveryPersonListAffectedBy(liveEvent)).toBe(affected);
  });
});
