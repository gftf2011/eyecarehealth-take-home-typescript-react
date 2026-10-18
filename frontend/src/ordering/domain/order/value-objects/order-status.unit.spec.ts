import { describe, expect, it } from 'vitest';

import { InvalidOrderStatusError, ORDER_STATUSES, OrderStatus, type OrderStatusValue } from '../..';

/** As transições válidas do enunciado; qualquer outra combinação é recusada. */
const VALID: readonly (readonly [OrderStatusValue, OrderStatusValue])[] = [
  ['pending', 'preparing'],
  ['pending', 'cancelled'],
  ['preparing', 'ready'],
  ['preparing', 'cancelled'],
  ['ready', 'delivering'],
  ['ready', 'cancelled'],
  ['delivering', 'delivered'],
];

const ALL_PAIRS = ORDER_STATUSES.flatMap((from) => ORDER_STATUSES.map((to) => [from, to] as const));

describe('OrderStatus', () => {
  it.each(ALL_PAIRS)('%s → %s segue a máquina de estados da API', (from, to) => {
    const expected = VALID.some(([validFrom, validTo]) => validFrom === from && validTo === to);
    expect(OrderStatus.of(from).canTransitionTo(to)).toBe(expected);
  });

  it.each<OrderStatusValue>(['delivered', 'cancelled'])('%s é final', (status) => {
    expect(OrderStatus.of(status).isFinal).toBe(true);
    expect(OrderStatus.of(status).allowedTransitions).toEqual([]);
  });

  it('recusa um status desconhecido apontando o campo', () => {
    const attempt = (): unknown => OrderStatus.create('shipped', 'status');

    expect(attempt).toThrow(InvalidOrderStatusError);
    expect(attempt).toThrow(expect.objectContaining({ field: 'status' }));
  });
});
