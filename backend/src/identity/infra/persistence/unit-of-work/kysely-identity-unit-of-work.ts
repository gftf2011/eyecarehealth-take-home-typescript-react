import type { Kysely } from 'kysely';

import { DomainEventBuffer, type EventMediator } from '../../../../shared-kernel/application';
import { publishCollectedEvents } from '../../../../shared-kernel/infra/events/publish-collected-events';
import type {
  IdentityRepositories,
  IdentityUnitOfWork,
} from '../../../application/ports/identity-unit-of-work';
import { KyselyRefreshSessionRepository } from '../repositories/kysely-refresh-session.repository';
import { KyselyUserRepository } from '../repositories/kysely-user.repository';
import type { IdentityDatabase } from '../schema/identity-database';

/**
 * Unit of work do Identity sobre uma transação do PostgreSQL; publica os
 * eventos coletados no mediador antes do commit (mesma semântica do Catalog).
 */
export class KyselyIdentityUnitOfWork implements IdentityUnitOfWork {
  constructor(
    private readonly db: Kysely<IdentityDatabase>,
    private readonly mediator: EventMediator,
  ) {}

  transaction<TResult>(work: (repositories: IdentityRepositories) => Promise<TResult>): Promise<TResult> {
    return this.db.transaction().execute(async (trx) => {
      const events = new DomainEventBuffer();
      const result = await work({
        users: new KyselyUserRepository(trx, events),
        sessions: new KyselyRefreshSessionRepository(trx, events),
      });
      await publishCollectedEvents(this.mediator, events, trx);
      return result;
    });
  }
}
