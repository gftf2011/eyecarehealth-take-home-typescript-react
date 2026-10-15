import { describe, expect, it } from 'vitest';

import { InvalidMoneyError, Money } from '../../../../shared-kernel/domain';
import { ProductId, ProductSnapshot } from '../../index';
import { BURGER_ID } from '../testing/order.fixture';

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
