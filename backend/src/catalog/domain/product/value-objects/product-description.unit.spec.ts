import { describe, expect, it } from 'vitest';

import { InvalidProductDescriptionError, ProductDescription } from '../../index';

describe('ProductDescription', () => {
  it.each(['a'.repeat(10), 'a'.repeat(500)])('aceita descrição no limite (%#)', (raw) => {
    expect(ProductDescription.create(raw).value).toBe(raw);
  });

  it.each(['a'.repeat(9), 'a'.repeat(501), '          '])('rejeita %j', (raw) => {
    expect(() => ProductDescription.create(raw)).toThrow(InvalidProductDescriptionError);
  });
});
