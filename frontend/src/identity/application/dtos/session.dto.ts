import type { Permission } from '../../../shared-kernel/domain';
import type { RoleValue, Session } from '../../domain';

/** O que a interface sabe da sessão: quem é e o que pode. O token não sai daqui. */
export type SessionDto = {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly role: RoleValue;
    readonly roleLabel: string;
  };
  readonly permissions: readonly Permission[];
  readonly expiresAt: Date;
};

export function toSessionDto(session: Session): SessionDto {
  return {
    user: {
      id: session.userId,
      email: session.email.value,
      role: session.role.value,
      roleLabel: session.role.label,
    },
    permissions: session.role.permissions,
    expiresAt: session.accessTokenExpiresAt,
  };
}
