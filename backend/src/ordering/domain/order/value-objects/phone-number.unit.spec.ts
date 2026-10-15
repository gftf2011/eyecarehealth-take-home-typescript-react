import { describe, expect, it } from 'vitest';

import { InvalidPhoneNumberError, PhoneNumber } from '../../index';

describe('PhoneNumber', () => {
  it.each(['(11) 99999-1234', '(21) 98765-4321'])('aceita %s', (raw) => {
    expect(PhoneNumber.create(raw).value).toBe(raw);
  });

  it.each(['11999991234', '(11) 9999-1234', '(11)99999-1234', '(11) 99999-12345', ''])(
    'rejeita %j',
    (raw) => {
      expect(() => PhoneNumber.create(raw)).toThrow(
        expect.objectContaining({ field: 'customerPhone' }),
      );
      expect(() => PhoneNumber.create(raw)).toThrow(InvalidPhoneNumberError);
    },
  );
});
