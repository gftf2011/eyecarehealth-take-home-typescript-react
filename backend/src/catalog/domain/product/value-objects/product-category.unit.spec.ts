import { describe, expect, it } from 'vitest';

import { InvalidProductCategoryError, ProductCategory } from '../../index';

describe('ProductCategory', () => {
  it.each(['meal', 'drink', 'dessert', 'side'])('aceita %s', (raw) => {
    expect(ProductCategory.create(raw).value).toBe(raw);
  });

  it.each(['MEAL', 'pizza', ''])('rejeita %j', (raw) => {
    expect(() => ProductCategory.create(raw)).toThrow(InvalidProductCategoryError);
  });
});
