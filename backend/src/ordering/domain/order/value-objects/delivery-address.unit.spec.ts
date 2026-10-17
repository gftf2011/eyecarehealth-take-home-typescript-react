import { describe, expect, it } from 'vitest';

import { DeliveryAddress, InvalidDeliveryAddressError } from '../..';

describe('DeliveryAddress', () => {
  it.each(['a'.repeat(10), 'a'.repeat(300)])('aceita endereço no limite (%#)', (raw) => {
    expect(DeliveryAddress.create(raw).value).toBe(raw);
  });

  it.each(['Rua A, 1', 'a'.repeat(301)])('rejeita %j', (raw) => {
    expect(() => DeliveryAddress.create(raw)).toThrow(InvalidDeliveryAddressError);
  });
});
