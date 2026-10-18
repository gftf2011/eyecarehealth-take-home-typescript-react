import { describe, expect, it } from 'vitest';

import { Email, InvalidEmailError } from '../..';

describe('Email', () => {
  it('normaliza com trim e minúsculas', () => {
    expect(Email.create('  Admin@FastMeals.com ').value).toBe('admin@fastmeals.com');
  });

  it.each([
    ['', 'Informe o email'],
    ['   ', 'Informe o email'],
    ['admin', 'Informe um email válido'],
    ['admin@fastmeals', 'Informe um email válido'],
    ['admin @fastmeals.com', 'Informe um email válido'],
    [`${'a'.repeat(250)}@x.com`, 'Informe um email válido'],
  ])('recusa %j com "%s"', (raw, message) => {
    expect(() => Email.create(raw)).toThrow(new InvalidEmailError(message));
  });

  it('o erro aponta o campo email', () => {
    const attempt = (): unknown => Email.create('');
    expect(attempt).toThrow(expect.objectContaining({ field: 'email', code: 'INVALID_EMAIL' }));
  });
});
