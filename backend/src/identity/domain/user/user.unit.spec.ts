import { describe, expect, it } from 'vitest';

import {
  PasswordHash,
  Role,
  User,
  UserPasswordChanged,
  UserRegistered,
  UserRoleChanged,
} from '../index.js';
import {
  BCRYPT_COST_12,
  buildRegisterUserParams,
  buildUser,
  LATER,
  REGISTERED_AT,
} from './testing/user.fixture.js';

describe('User', () => {
  it('é cadastrado com evento UserRegistered sem expor o hash', () => {
    const user = User.register(buildRegisterUserParams());

    expect(user.email.value).toBe('admin@fastmeals.com');
    expect(user.createdAt).toEqual(REGISTERED_AT);
    const [event] = user.pullDomainEvents();
    expect(event).toBeInstanceOf(UserRegistered);
    expect(event?.payload).toEqual({ email: 'admin@fastmeals.com', role: 'admin' });
    expect(JSON.stringify(event)).not.toContain('$2a$');
  });

  it('reidrata o estado sem emitir eventos', () => {
    const original = buildUser();

    const restored = User.reconstitute(original.id, original.snapshot());

    expect(restored.equals(original)).toBe(true);
    expect(restored.domainEvents).toHaveLength(0);
  });

  it('delega as permissões ao papel', () => {
    const viewer = buildUser({ role: Role.of('viewer') });

    expect(viewer.can('orders:read')).toBe(true);
    expect(viewer.can('orders:write')).toBe(false);
  });

  describe('changeRole', () => {
    it('troca o papel e emite UserRoleChanged', () => {
      const user = buildUser();

      user.changeRole(Role.of('viewer'), LATER);

      expect(user.role.value).toBe('viewer');
      expect(user.updatedAt).toEqual(LATER);
      const [event] = user.pullDomainEvents();
      expect(event).toBeInstanceOf(UserRoleChanged);
      expect(event?.payload).toEqual({ from: 'admin', to: 'viewer' });
    });

    it('é no-op para o mesmo papel', () => {
      const user = buildUser();

      user.changeRole(Role.of('admin'), LATER);

      expect(user.domainEvents).toHaveLength(0);
    });
  });

  describe('changePassword', () => {
    it('troca o hash e emite UserPasswordChanged sem payload', () => {
      const user = buildUser();

      user.changePassword(PasswordHash.fromHash(BCRYPT_COST_12), LATER);

      expect(user.passwordHash.cost).toBe(12);
      const [event] = user.pullDomainEvents();
      expect(event).toBeInstanceOf(UserPasswordChanged);
      expect(event?.payload).toEqual({});
    });
  });
});
