import { describe, expect, it } from 'vitest';

import { InvalidProductNameError, ProductName } from '../..';

describe('ProductName', () => {
  it.each(['abc', 'a'.repeat(120), '  X-Burger  '])('aceita %j', (raw) => {
    expect(ProductName.create(raw).value).toBe(raw.trim());
  });

  it.each(['ab', '   ab   ', 'a'.repeat(121), ''])('rejeita %j', (raw) => {
    expect(() => ProductName.create(raw)).toThrow(InvalidProductNameError);
  });

  it('associa o erro ao campo name', () => {
    expect(() => ProductName.create('ab')).toThrow(
      expect.objectContaining({ field: 'name', code: 'INVALID_PRODUCT_NAME' }),
    );
  });
});
