import { describe, expect, it } from 'vitest';

import { InvalidPersonNameError } from '../errors';
import { PersonName } from './person-name';

describe('PersonName (mesma regra da API)', () => {
  it.each(['Ana', 'a'.repeat(100), '  Carlos Santos '])('aceita %j', (raw) => {
    expect(PersonName.create(raw).value).toBe(raw.trim());
  });

  it.each(['Al', 'a'.repeat(101), '    '])('recusa %j no campo name', (raw) => {
    expect(() => PersonName.create(raw)).toThrow(InvalidPersonNameError);
    expect(() => PersonName.create(raw)).toThrow(expect.objectContaining({ field: 'name' }));
  });
});
