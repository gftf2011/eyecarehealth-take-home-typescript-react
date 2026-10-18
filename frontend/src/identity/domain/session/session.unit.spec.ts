import { describe, expect, it } from 'vitest';

import { Email, InvalidSessionError, Role, Session } from '..';
import { FIFTEEN_MINUTES, NOW, buildSession } from './testing/session.fixture';

describe('Session', () => {
  it('sabe se o token vence dentro da margem', () => {
    const session = buildSession({ expiresAt: new Date(NOW.getTime() + 30_000) });

    expect(session.isExpiringWithin(30_000, NOW)).toBe(true);
    expect(session.isExpiringWithin(29_999, NOW)).toBe(false);
  });

  it('token já vencido também está "vencendo"', () => {
    const session = buildSession({ expiresAt: new Date(NOW.getTime() - 1) });
    expect(session.isExpiringWithin(0, NOW)).toBe(true);
  });

  it('responde às permissões pelo perfil', () => {
    const viewer = buildSession({ role: 'viewer' });

    expect(viewer.can('orders:read')).toBe(true);
    expect(viewer.can('orders:write')).toBe(false);
  });

  it('não deixa alterar a expiração por fora', () => {
    const session = buildSession();
    session.accessTokenExpiresAt.setTime(0);

    expect(session.isExpiringWithin(FIFTEEN_MINUTES - 1, NOW)).toBe(false);
  });

  it.each([
    ['accessToken', { accessToken: ' ' }],
    ['accessTokenExpiresAt', { accessTokenExpiresAt: new Date('inválida') }],
    ['userId', { userId: '' }],
  ])('recusa sessão com %s inválido', (field, override) => {
    const attempt = (): unknown =>
      Session.start({
        userId: 'user-1',
        email: Email.create('admin@fastmeals.com'),
        role: Role.of('admin'),
        accessToken: 'access-1',
        accessTokenExpiresAt: new Date(NOW.getTime() + FIFTEEN_MINUTES),
        ...override,
      });

    expect(attempt).toThrow(InvalidSessionError);
    expect(attempt).toThrow(expect.objectContaining({ field }));
  });
});
