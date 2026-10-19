import { sql, type Kysely } from 'kysely';

/** Perfil `courier`: o entregador entra no sistema para ver e concluir as próprias entregas. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users DROP CONSTRAINT users_role_check`.execute(db);
  await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role in ('admin', 'viewer', 'courier'))`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users DROP CONSTRAINT users_role_check`.execute(db);
  await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role in ('admin', 'viewer'))`.execute(db);
}
