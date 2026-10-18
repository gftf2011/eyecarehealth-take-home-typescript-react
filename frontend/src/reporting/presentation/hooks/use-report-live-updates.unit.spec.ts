import { describe, expect, it } from 'vitest';

import type { LiveEvent } from '../../../shared-kernel/application';
import type { ReportKind } from './use-report';
import { reportAffectedBy } from './use-report-live-updates';

const event = (topic: string, payload: Record<string, unknown>): LiveEvent => ({
  id: 'e1',
  topic,
  occurredAt: '2026-10-18T12:00:00.000Z',
  payload,
});
const order = (payload: Record<string, unknown>) => event('ordering.order-updates', payload);
const product = (type: string) => event('catalog.product-updates', { type, productId: 'p1' });

const KINDS: readonly ReportKind[] = ['revenue', 'ordersByStatus', 'topProducts', 'deliveryTime'];
const affectedKinds = (liveEvent: LiveEvent): ReportKind[] =>
  KINDS.filter((kind) => reportAffectedBy(liveEvent, ['reports', kind, '2026-10-01', '2026-10-17']));

describe('reportAffectedBy', () => {
  it('pedido novo só muda a contagem por status', () => {
    expect(affectedKinds(order({ type: 'order.placed', status: 'pending' }))).toEqual(['ordersByStatus']);
  });

  it('pedido entregue muda os quatro relatórios', () => {
    expect(affectedKinds(order({ type: 'order.status-changed', previousStatus: 'delivering', status: 'delivered' }))).toEqual(
      KINDS,
    );
  });

  it('outras mudanças de status só mexem na contagem por status', () => {
    expect(affectedKinds(order({ type: 'order.status-changed', previousStatus: 'pending', status: 'preparing' }))).toEqual([
      'ordersByStatus',
    ]);
  });

  it('troca de entregador não muda nenhum', () => {
    expect(affectedKinds(order({ type: 'order.delivery-person-assigned' }))).toEqual([]);
  });

  it('produto editado muda os mais vendidos (nome atual); preço e disponibilidade, nada', () => {
    expect(affectedKinds(product('product.updated'))).toEqual(['topProducts']);
    expect(affectedKinds(product('product.price-changed'))).toEqual([]);
    expect(affectedKinds(product('product.availability-changed'))).toEqual([]);
  });
});
