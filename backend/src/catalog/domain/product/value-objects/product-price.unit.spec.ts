import { describe, expect, it } from 'vitest';

import { Money } from '../../../../shared-kernel/domain/index';
import { InvalidProductPriceError, ProductPrice } from '../../index';

describe('ProductPrice', () => {
  it.each([
    [0.01, 1],
    [32.9, 3290],
    [99_999_999.99, 9_999_999_999],
  ])('aceita %d', (raw, cents) => {
    expect(ProductPrice.fromDecimal(raw).amount.cents).toBe(cents);
  });

  it.each([
    [0, 'O preço deve ser maior que zero'],
    [-5, 'O preço deve ser maior que zero'],
    [Number.NaN, 'O preço deve ser maior que zero'],
    [10.999, 'O preço deve ter no máximo 2 casas decimais'],
    [100_000_000, 'O preço excede o valor máximo permitido'],
  ])('rejeita %d', (raw, message) => {
    expect(() => ProductPrice.fromDecimal(raw)).toThrow(
      expect.objectContaining({ field: 'price', message }),
    );
  });

  it('rejeita Money zerado na reidratação', () => {
    expect(() => ProductPrice.fromMoney(Money.zero())).toThrow(InvalidProductPriceError);
  });
});
