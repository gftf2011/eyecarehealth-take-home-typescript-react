import { sql } from 'kysely';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  connectToTestDatabase,
  resetDatabase,
} from '../../../../shared-kernel/infra/database/testing/test-database';
import { Email, Role, type RefreshSession, type User } from '../../../domain';
import { buildSession, ONE_HOUR_LATER } from '../../../domain/session/testing/refresh-session.fixture';
import { buildUser, BCRYPT_COST_12 } from '../../../domain/user/testing/user.fixture';
import type { IdentityDatabase } from '../schema/identity-database';
import { KyselyIdentityUnitOfWork } from './kysely-identity-unit-of-work';

const db = connectToTestDatabase<IdentityDatabase>();
const unitOfWork = new KyselyIdentityUnitOfWork(db);

async function saveUser(user: User): Promise<void> {
  await unitOfWork.transaction(({ users }) => users.save(user));
}

async function saveSession(session: RefreshSession): Promise<void> {
  await unitOfWork.transaction(({ sessions }) => sessions.save(session));
}

describe('KyselyIdentityUnitOfWork (users e refresh_sessions)', () => {
  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('usuários', () => {
    it('persiste e encontra por ID e por email', async () => {
      const user = buildUser();
      await saveUser(user);

      const byId = await unitOfWork.transaction(({ users }) => users.findById(user.id));
      const byEmail = await unitOfWork.transaction(({ users }) =>
        users.findByEmail(Email.create('ADMIN@fastmeals.com')),
      );

      expect(byId?.snapshot()).toEqual(user.snapshot());
      expect(byEmail?.id.equals(user.id)).toBe(true);
    });

    it('atualiza papel e senha', async () => {
      const user = buildUser();
      await saveUser(user);

      user.changeRole(Role.of('viewer'), ONE_HOUR_LATER);
      await saveUser(user);

      const found = await unitOfWork.transaction(({ users }) => users.findById(user.id));
      expect(found?.role.value).toBe('viewer');
    });

    it('o banco impede dois usuários com o mesmo email', async () => {
      await saveUser(buildUser());

      await expect(saveUser(buildUser())).rejects.toThrow(/unique|duplicate/i);
    });

    it('o banco recusa hash de senha fora do padrão bcrypt (custo < 10)', async () => {
      const user = buildUser({});
      await saveUser(user);

      await expect(
        sql`UPDATE users SET password_hash = ${BCRYPT_COST_12.replace('$12$', '$09$')}`.execute(db),
      ).rejects.toThrow(/check/i);
    });
  });

  describe('sessões de refresh', () => {
    it('persiste a sessão, a rotação e a revogação', async () => {
      const user = buildUser();
      await saveUser(user);
      const session = buildSession({ userId: user.id });
      await saveSession(session);

      session.revoke('logout', ONE_HOUR_LATER);
      await saveSession(session);

      const found = await unitOfWork.transaction(({ sessions }) => sessions.findById(session.id));
      expect(found?.snapshot()).toEqual(session.snapshot());
      expect(found?.revocationReason).toBe('logout');

      const events = await db.selectFrom('outbox_events').select('event_name').execute();
      expect(events.map((event) => event.event_name)).toEqual(['identity.refresh-session.revoked']);
    });

    it('apagar o usuário apaga as sessões dele (FK em cascata)', async () => {
      const user = buildUser();
      await saveUser(user);
      await saveSession(buildSession({ userId: user.id }));

      await sql`DELETE FROM users`.execute(db);

      const { rows } = await sql<{ total: string }>`SELECT count(*) AS total FROM refresh_sessions`.execute(db);
      expect(rows[0]?.total).toBe('0');
    });

    it('não permite sessão de usuário inexistente', async () => {
      await expect(saveSession(buildSession())).rejects.toThrow(/foreign key/i);
    });
  });
});
