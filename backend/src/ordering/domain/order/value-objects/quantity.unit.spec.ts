import { describe, expect, it } from 'vitest';

import { InvalidQuantityError, Quantity } from '../../index';

describe('Quantity', () => {
  it('aceita inteiros positivos e soma', () => {
    expect(Quantity.of(2).add(Quantity.of(3)).value).toBe(5);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejeita %d', (value) => {
    expect(() => Quantity.of(value)).toThrow(InvalidQuantityError);
  });
});
