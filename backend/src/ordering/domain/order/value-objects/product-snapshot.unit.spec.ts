import { describe, expect, it } from 'vitest';

import { InvalidMoneyError, Money } from '../../../../shared-kernel/domain/index.js';
import { ProductId, ProductSnapshot } from '../../index.js';
import { BURGER_ID } from '../testing/order.fixture.js';

describe('ProductSnapshot', () => {
  it('rejeita preço unitário zerado', () => {
    expect(() =>
      ProductSnapshot.create({
        productId: ProductId.from(BURGER_ID),
        name: 'Brinde',
        unitPrice: Money.zero(),
        isAvailable: true,
      }),
    ).toThrow(InvalidMoneyError);
  });
});
