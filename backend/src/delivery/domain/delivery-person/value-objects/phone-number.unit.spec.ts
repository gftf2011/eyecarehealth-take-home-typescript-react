import { describe, expect, it } from 'vitest';

import { InvalidPhoneNumberError, PhoneNumber } from '../../index.js';

describe('PhoneNumber', () => {
  it('aceita o formato (XX) XXXXX-XXXX', () => {
    expect(PhoneNumber.create('(11) 91234-5678').value).toBe('(11) 91234-5678');
  });

  it.each(['11912345678', '(11) 1234-5678', ''])('rejeita %j no campo phone', (raw) => {
    expect(() => PhoneNumber.create(raw)).toThrow(InvalidPhoneNumberError);
    expect(() => PhoneNumber.create(raw)).toThrow(expect.objectContaining({ field: 'phone' }));
  });
});
