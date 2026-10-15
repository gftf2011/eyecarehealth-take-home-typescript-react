import { describe, expect, it } from 'vitest';

import {
  InvalidRoleError,
  PERMISSIONS,
  PermissionDeniedError,
  Role,
  type Permission,
  type RoleValue,
} from '../../index';

/** Matriz do enunciado: viewer só lê pedidos, produtos e relatórios. */
const VIEWER_ALLOWED: ReadonlySet<Permission> = new Set([
  'products:read',
  'orders:read',
  'reports:read',
]);

const MATRIX = PERMISSIONS.flatMap((permission) => [
  ['admin', permission, true] as [RoleValue, Permission, boolean],
  ['viewer', permission, VIEWER_ALLOWED.has(permission)] as [RoleValue, Permission, boolean],
]);

describe('Role', () => {
  it('rejeita papel desconhecido', () => {
    expect(() => Role.create('superuser')).toThrow(InvalidRoleError);
  });

  it.each(MATRIX)('%s pode %s? %s', (role, permission, allowed) => {
    expect(Role.of(role).can(permission)).toBe(allowed);
  });

  it('ensureCan lança FORBIDDEN quando falta a permissão', () => {
    expect(() => Role.of('viewer').ensureCan('products:write')).toThrow(PermissionDeniedError);
    expect(() => Role.of('viewer').ensureCan('products:write')).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => Role.of('admin').ensureCan('products:write')).not.toThrow();
  });

  it('lista as permissões do papel', () => {
    expect(Role.of('viewer').permissions).toEqual(['products:read', 'orders:read', 'reports:read']);
    expect(Role.of('admin').permissions).toEqual(PERMISSIONS);
  });
});
