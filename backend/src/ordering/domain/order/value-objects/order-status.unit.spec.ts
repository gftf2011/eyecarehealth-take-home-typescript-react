import { describe, expect, it } from 'vitest';

import { InvalidOrderStatusError, OrderStatus } from '../../index';

describe('OrderStatus', () => {
  it('rejeita status desconhecido', () => {
    expect(() => OrderStatus.create('shipped')).toThrow(InvalidOrderStatusError);
  });

  it.each([
    ['delivered', true],
    ['cancelled', true],
    ['delivering', false],
    ['pending', false],
  ] as const)('%s é final? %s', (status, isFinal) => {
    expect(OrderStatus.of(status).isFinal).toBe(isFinal);
  });

  it('expõe as transições permitidas a partir do status atual', () => {
    expect(OrderStatus.of('ready').allowedTransitions).toEqual(['delivering', 'cancelled']);
  });
});
