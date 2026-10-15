import { describe, expect, it } from 'vitest';

import { CustomerName, InvalidCustomerNameError } from '../../index.js';

describe('CustomerName', () => {
  it.each(['Ana', 'a'.repeat(100), '  Maria Oliveira '])('aceita %j', (raw) => {
    expect(CustomerName.create(raw).value).toBe(raw.trim());
  });

  it.each(['Jo', 'a'.repeat(101), '   '])('rejeita %j', (raw) => {
    expect(() => CustomerName.create(raw)).toThrow(InvalidCustomerNameError);
  });
});
