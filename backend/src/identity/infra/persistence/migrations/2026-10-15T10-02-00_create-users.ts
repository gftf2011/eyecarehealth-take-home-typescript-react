import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    // O domínio normaliza para minúsculas; a constraint garante isso no banco também.
    .addColumn('email', 'varchar(255)', (col) =>
      col.notNull().unique().check(sql`email = lower(email)`),
    )
    // Defesa em profundidade: só hash bcrypt com custo 10..31 (enunciado: mínimo 10).
    .addColumn('password_hash', 'varchar(60)', (col) =>
      col.notNull().check(sql`password_hash ~ '^\\$2[aby]\\$(1[0-9]|2[0-9]|3[01])\\$'`),
    )
    .addColumn('role', 'varchar(20)', (col) => col.notNull().check(sql`role in ('admin', 'viewer')`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`
    CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('users').execute();
}
