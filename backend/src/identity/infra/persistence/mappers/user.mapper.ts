import type { Insertable, Selectable } from 'kysely';

import { Email, PasswordHash, Role, User, UserId } from '../../../domain';
import type { UsersTable } from '../schema/identity-database';

export function toUser(row: Selectable<UsersTable>): User {
  return User.reconstitute(UserId.from(row.id), {
    email: Email.create(row.email),
    passwordHash: PasswordHash.fromHash(row.password_hash),
    role: Role.create(row.role),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function toUserRow(user: User): Insertable<UsersTable> {
  return {
    id: user.id.value,
    email: user.email.value,
    password_hash: user.passwordHash.value,
    role: user.role.value,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}
