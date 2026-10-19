import type { Migration } from 'kysely/migration';

import * as createUsers from './2026-10-15T10-02-00_create-users';
import * as createRefreshSessions from './2026-10-15T10-03-00_create-refresh-sessions';
import * as addCourierRole from './2026-10-19T13-00-00_add-courier-role';

/** Migrations do contexto Identity. */
export const identityMigrations: Record<string, Migration> = {
  '2026-10-15T10-02-00_create-users': createUsers,
  '2026-10-15T10-03-00_create-refresh-sessions': createRefreshSessions,
  '2026-10-19T13-00-00_add-courier-role': addCourierRole,
};
