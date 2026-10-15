import { ValueObject } from '../../../../shared-kernel/domain/index';
import { InvalidRoleError, PermissionDeniedError } from '../errors/index';
import { PERMISSIONS, type Permission } from './permission';

export const ROLES = ['admin', 'viewer'] as const;

export type RoleValue = (typeof ROLES)[number];

/**
 * Matriz de autorização do enunciado:
 * - admin: acesso total.
 * - viewer: somente leitura de pedidos, produtos e relatórios.
 */
const ROLE_PERMISSIONS: Readonly<Record<RoleValue, ReadonlySet<Permission>>> = {
  admin: new Set(PERMISSIONS),
  viewer: new Set<Permission>(['products:read', 'orders:read', 'reports:read']),
};

export class Role extends ValueObject<{ value: RoleValue }> {
  private constructor(value: RoleValue) {
    super({ value });
  }

  static of(value: RoleValue): Role {
    return new Role(value);
  }

  static create(raw: string): Role {
    if (!Role.isValid(raw)) {
      throw new InvalidRoleError(`O perfil deve ser um de: ${ROLES.join(', ')}`);
    }
    return new Role(raw);
  }

  static isValid(raw: string): raw is RoleValue {
    return (ROLES as readonly string[]).includes(raw);
  }

  get value(): RoleValue {
    return this.props.value;
  }

  get permissions(): readonly Permission[] {
    return PERMISSIONS.filter((permission) => this.can(permission));
  }

  can(permission: Permission): boolean {
    return ROLE_PERMISSIONS[this.props.value].has(permission);
  }

  ensureCan(permission: Permission): void {
    if (!this.can(permission)) throw new PermissionDeniedError(this.props.value, permission);
  }
}
