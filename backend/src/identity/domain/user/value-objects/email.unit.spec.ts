import { describe, expect, it } from 'vitest';

import { Email, InvalidEmailError } from '../..';

describe('Email', () => {
  it('normaliza com trim e minúsculas', () => {
    expect(Email.create('  Admin@FastMeals.com ').value).toBe('admin@fastmeals.com');
  });

  it('considera iguais emails que diferem só na caixa', () => {
    expect(Email.create('VIEWER@fastmeals.com').equals(Email.create('viewer@fastmeals.com'))).toBe(
      true,
    );
  });

  it.each(['', 'admin', 'admin@', '@fastmeals.com', 'admin@fastmeals', 'a b@c.com', `${'a'.repeat(250)}@x.com`])(
    'rejeita %j',
    (raw) => {
      expect(() => Email.create(raw)).toThrow(InvalidEmailError);
    },
  );
});
