import type { Kysely } from 'kysely';

import type {
  IdentityRepositories,
  IdentityUnitOfWork,
} from '../../../application/ports/identity-unit-of-work';
import { KyselyRefreshSessionRepository } from '../repositories/kysely-refresh-session.repository';
import { KyselyUserRepository } from '../repositories/kysely-user.repository';
import type { IdentityDatabase } from '../schema/identity-database';

/** Unit of work do Identity sobre uma transação do PostgreSQL. */
export class KyselyIdentityUnitOfWork implements IdentityUnitOfWork {
  constructor(private readonly db: Kysely<IdentityDatabase>) {}

  transaction<TResult>(work: (repositories: IdentityRepositories) => Promise<TResult>): Promise<TResult> {
    return this.db.transaction().execute((trx) =>
      work({
        users: new KyselyUserRepository(trx),
        sessions: new KyselyRefreshSessionRepository(trx),
      }),
    );
  }
}
