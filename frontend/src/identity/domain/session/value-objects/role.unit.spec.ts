import { describe, expect, it } from 'vitest';

import { PERMISSIONS, type Permission } from '../../../../shared-kernel/domain';
import { InvalidRoleError, Role } from '../..';

describe('Role', () => {
  it('admin tem todas as permissões', () => {
    expect(Role.of('admin').permissions).toEqual(PERMISSIONS);
  });

  it.each<[Permission, boolean]>([
    ['products:read', true],
    ['orders:read', true],
    ['reports:read', true],
    ['products:write', false],
    ['orders:write', false],
    ['delivery-persons:read', false],
    ['delivery-persons:write', false],
  ])('viewer → %s: %s', (permission, allowed) => {
    expect(Role.of('viewer').can(permission)).toBe(allowed);
  });

  it('recusa um perfil desconhecido', () => {
    expect(() => Role.create('root')).toThrow(InvalidRoleError);
  });

  it('tem um rótulo para a interface', () => {
    expect(Role.of('viewer').label).toBe('Somente leitura');
  });
});
