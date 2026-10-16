import type { Transaction } from 'kysely';

import type { DomainEventBuffer } from '../../../../shared-kernel/application';
import type { RefreshSession, RefreshSessionId, RefreshSessionRepository } from '../../../domain';
import { toRefreshSession, toRefreshSessionRow } from '../mappers/refresh-session.mapper';
import type { IdentityDatabase } from '../schema/identity-database';

export class KyselyRefreshSessionRepository implements RefreshSessionRepository {
  constructor(
    private readonly trx: Transaction<IdentityDatabase>,
    private readonly events: DomainEventBuffer,
  ) {}

  /**
   * Trava a linha (`FOR UPDATE`): duas renovações simultâneas do mesmo token
   * são serializadas, e a segunda enxerga a rotação da primeira (reuso).
   */
  async findById(id: RefreshSessionId): Promise<RefreshSession | null> {
    const row = await this.trx
      .selectFrom('refresh_sessions')
      .selectAll()
      .where('id', '=', id.value)
      .forUpdate()
      .executeTakeFirst();
    return row === undefined ? null : toRefreshSession(row);
  }

  async save(session: RefreshSession): Promise<void> {
    const row = toRefreshSessionRow(session);
    // Dono e criação da sessão nunca mudam; só o estado da rotação/revogação.
    const { id: _id, user_id: _userId, created_at: _createdAt, ...changes } = row;
    await this.trx
      .insertInto('refresh_sessions')
      .values(row)
      .onConflict((conflict) => conflict.column('id').doUpdateSet(changes))
      .execute();
    this.events.collectFrom(session);
  }
}
