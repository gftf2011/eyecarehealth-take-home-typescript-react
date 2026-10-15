import { describe, expect, it } from 'vitest';

import { OrdersByStatusReport } from '../index';

describe('OrdersByStatusReport', () => {
  it('traz os 6 status na ordem do fluxo, com zero para os ausentes', () => {
    const report = OrdersByStatusReport.build([
      { status: 'delivered', count: 284 },
      { status: 'pending', count: 15 },
    ]);

    expect(report.data).toEqual([
      { status: 'pending', count: 15 },
      { status: 'preparing', count: 0 },
      { status: 'ready', count: 0 },
      { status: 'delivering', count: 0 },
      { status: 'delivered', count: 284 },
      { status: 'cancelled', count: 0 },
    ]);
    expect(report.total).toBe(299);
    expect(report.countOf('preparing')).toBe(0);
  });

  it('sem pedidos, total zero', () => {
    expect(OrdersByStatusReport.build([]).total).toBe(0);
  });

  it.each([
    [{ status: 'shipped', count: 1 }, /desconhecido/],
    [{ status: 'pending', count: -1 }, /inválida/],
  ])('rejeita dado inconsistente do adapter %#', (row, message) => {
    expect(() => OrdersByStatusReport.build([row])).toThrow(message);
  });
});
