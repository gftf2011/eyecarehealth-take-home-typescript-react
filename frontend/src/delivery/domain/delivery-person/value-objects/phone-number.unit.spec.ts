import { describe, expect, it } from 'vitest';

import { InvalidPhoneNumberError } from '../errors';
import { PhoneNumber } from './phone-number';

describe('PhoneNumber (mesma regra da API)', () => {
  it('aceita (XX) XXXXX-XXXX, sem espaços nas pontas', () => {
    expect(PhoneNumber.create(' (11) 91234-5678 ').value).toBe('(11) 91234-5678');
  });

  it.each(['11912345678', '(11) 1234-5678', '(11)91234-5678', ''])('recusa %j no campo phone', (raw) => {
    expect(() => PhoneNumber.create(raw)).toThrow(InvalidPhoneNumberError);
    expect(() => PhoneNumber.create(raw)).toThrow(expect.objectContaining({ field: 'phone' }));
  });
});
