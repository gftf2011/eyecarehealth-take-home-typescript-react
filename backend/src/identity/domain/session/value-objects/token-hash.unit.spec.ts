import { describe, expect, it } from 'vitest';

import { InvalidTokenHashError, TokenHash } from '../../index.js';

describe('TokenHash', () => {
  it('aceita SHA-256 hex e normaliza para minúsculas', () => {
    expect(TokenHash.fromHex('A'.repeat(64)).value).toBe('a'.repeat(64));
  });

  it.each(['', 'a'.repeat(63), 'g'.repeat(64), 'eyJhbGciOiJIUzI1NiJ9.e30.x'])('rejeita %j', (raw) => {
    expect(() => TokenHash.fromHex(raw)).toThrow(InvalidTokenHashError);
  });

  it('não vaza o hash em toString/JSON', () => {
    expect(JSON.stringify({ hash: TokenHash.fromHex('a'.repeat(64)) })).toBe(
      '{"hash":"[TokenHash]"}',
    );
  });
});
