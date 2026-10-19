import { describe, expect, it } from 'vitest';

import type { LiveEvent } from '../../../shared-kernel/application';
import { dispatchBoardAffectedBy } from './use-dispatch-board-live-updates';

const event = (payload: Record<string, unknown>): LiveEvent => ({
  id: 'e1',
  topic: 'ordering.order-updates',
  occurredAt: '2026-10-18T12:00:00.000Z',
  payload,
});
const changed = (previousStatus: string, status: string) =>
  event({ type: 'order.status-changed', orderId: 'o1', previousStatus, status });

describe('dispatchBoardAffectedBy', () => {
  it.each([
    ['pedido ficou pronto', changed('preparing', 'ready'), true],
    ['pedido pronto foi despachado', changed('ready', 'delivering'), true],
    ['pedido pronto foi cancelado', changed('ready', 'cancelled'), true],
    ['entrega concluída libera o entregador', changed('delivering', 'delivered'), true],
    ['pedido entrou em preparo', changed('pending', 'preparing'), false],
    ['pedido novo nasce pending', event({ type: 'order.placed', orderId: 'o1', status: 'pending' }), false],
    ['troca de entregador', event({ type: 'order.delivery-person-assigned', orderId: 'o1' }), true],
    ['pedido pronto perdeu o entregador desativado', event({ type: 'order.delivery-person-unassigned', orderId: 'o1' }), true],
    ['tipo desconhecido, na dúvida recarrega', event({ type: 'order.algo-novo', orderId: 'o1' }), true],
  ])('%s → %s', (_, liveEvent, affected) => {
    expect(dispatchBoardAffectedBy(liveEvent)).toBe(affected);
  });
});
