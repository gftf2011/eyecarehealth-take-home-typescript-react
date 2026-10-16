import type { Transaction } from 'kysely';

import type { DomainEventBuffer } from '../../../../shared-kernel/application';
import type { Email, User, UserId, UserRepository } from '../../../domain';
import { toUser, toUserRow } from '../mappers/user.mapper';
import type { IdentityDatabase } from '../schema/identity-database';

export class KyselyUserRepository implements UserRepository {
  constructor(
    private readonly trx: Transaction<IdentityDatabase>,
    private readonly events: DomainEventBuffer,
  ) {}

  async findById(id: UserId): Promise<User | null> {
    const row = await this.trx.selectFrom('users').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row === undefined ? null : toUser(row);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.trx
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email.value)
      .executeTakeFirst();
    return row === undefined ? null : toUser(row);
  }

  async save(user: User): Promise<void> {
    const { id, created_at: _createdAt, ...changes } = toUserRow(user);
    await this.trx
      .insertInto('users')
      .values({ id, created_at: user.createdAt, ...changes })
      .onConflict((conflict) => conflict.column('id').doUpdateSet(changes))
      .execute();
    this.events.collectFrom(user);
  }
}
