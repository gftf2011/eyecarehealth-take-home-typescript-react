import { describe, expect, it } from 'vitest';

import { InvalidPersonNameError, PersonName } from '../../index.js';

describe('PersonName', () => {
  it.each(['Ana', 'a'.repeat(100), '  Carlos Santos '])('aceita %j', (raw) => {
    expect(PersonName.create(raw).value).toBe(raw.trim());
  });

  it.each(['Al', 'a'.repeat(101), '    '])('rejeita %j', (raw) => {
    expect(() => PersonName.create(raw)).toThrow(InvalidPersonNameError);
  });
});
