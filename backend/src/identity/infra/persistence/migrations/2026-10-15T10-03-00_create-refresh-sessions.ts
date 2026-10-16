import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('refresh_sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    // Só o SHA-256 do refresh token é guardado.
    .addColumn('token_hash', 'char(64)', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('rotated_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('revocation_reason', 'varchar(20)', (col) =>
      col.check(sql`revocation_reason in ('logout', 'reuse-detected')`),
    )
    .addCheckConstraint(
      'refresh_sessions_revocation_consistent',
      sql`(revoked_at IS NULL) = (revocation_reason IS NULL)`,
    )
    .execute();

  // FK não é indexada automaticamente no PostgreSQL.
  await db.schema.createIndex('idx_refresh_sessions_user_id').on('refresh_sessions').column('user_id').execute();
  // Limpeza periódica de sessões vencidas.
  await db.schema.createIndex('idx_refresh_sessions_expires_at').on('refresh_sessions').column('expires_at').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('refresh_sessions').execute();
}
