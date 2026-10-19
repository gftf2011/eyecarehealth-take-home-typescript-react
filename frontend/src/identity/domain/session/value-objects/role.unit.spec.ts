import { describe, expect, it } from 'vitest';

import { PERMISSIONS, type Permission } from '../../../../shared-kernel/domain';
import { InvalidRoleError, Role } from '../..';

describe('Role', () => {
  it('admin tem todas as permissões do painel, nenhuma de entregador', () => {
    expect(Role.of('admin').permissions).toEqual(
      PERMISSIONS.filter((permission) => !permission.startsWith('my-deliveries:')),
    );
  });

  it('o entregador só tem as próprias entregas (mesma matriz da API)', () => {
    expect(Role.of('courier').permissions).toEqual(['my-deliveries:read', 'my-deliveries:write']);
    expect(Role.of('courier').label).toBe('Entregador');
  });

  it.each<[Permission, boolean]>([
    ['products:read', true],
    ['orders:read', true],
    ['reports:read', true],
    ['products:write', false],
    ['orders:write', false],
    ['delivery-persons:read', false],
    ['delivery-persons:write', false],
    ['my-deliveries:read', false],
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
