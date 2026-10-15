import { describe, expect, it } from 'vitest';

import { InvalidPasswordHashError, PasswordHash } from '../../index.js';
import { BCRYPT_COST_10, BCRYPT_COST_12 } from '../testing/user.fixture.js';

const SALT_AND_HASH = BCRYPT_COST_10.slice(7);

describe('PasswordHash', () => {
  it.each([
    [BCRYPT_COST_10, 10],
    [BCRYPT_COST_12, 12],
    [`$2y$31$${SALT_AND_HASH}`, 31],
  ])('aceita hash bcrypt %s (custo %d)', (hash, cost) => {
    expect(PasswordHash.fromHash(hash).cost).toBe(cost);
  });

  it('rejeita custo abaixo de 10 salt rounds', () => {
    expect(() => PasswordHash.fromHash(`$2b$09$${SALT_AND_HASH}`)).toThrow(
      expect.objectContaining({
        message: 'O hash da senha deve usar no mínimo 10 salt rounds',
      }),
    );
  });

  it.each(['Admin@123', '', `$2b$10$${SALT_AND_HASH}x`, `$1$10$${SALT_AND_HASH}`])(
    'rejeita valor que não é bcrypt: %j',
    (raw) => {
      expect(() => PasswordHash.fromHash(raw)).toThrow(InvalidPasswordHashError);
    },
  );

  it('não vaza o hash em toString/JSON', () => {
    const hash = PasswordHash.fromHash(BCRYPT_COST_10);
    expect(String(hash)).toBe('[PasswordHash]');
    expect(JSON.stringify({ hash })).toBe('{"hash":"[PasswordHash]"}');
  });
});
