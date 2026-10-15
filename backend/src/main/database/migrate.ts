/**
 * CLI de migrations.
 *   npm run migrate:latest   aplica todas as pendentes
 *   npm run migrate:down     desfaz a última (uso em desenvolvimento)
 */
import { createKysely, createPostgresPool } from '../../shared-kernel/infra/database/postgres';
import { createMigrator } from './migrations';

const COMMANDS = ['latest', 'down'] as const;
type Command = (typeof COMMANDS)[number];

function parseCommand(raw: string | undefined): Command {
  const command = COMMANDS.find((candidate) => candidate === raw);
  if (command === undefined) {
    throw new Error(`Uso: migrate <${COMMANDS.join('|')}> (recebido: ${raw ?? 'nada'})`);
  }
  return command;
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv[2]);
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL não definida');
  }

  const pool = createPostgresPool(connectionString);
  const db = createKysely<unknown>(pool);
  try {
    const migrator = createMigrator(db);
    const { error, results = [] } =
      command === 'latest' ? await migrator.migrateToLatest() : await migrator.migrateDown();

    for (const result of results) {
      console.info(`${result.status.padEnd(7)} ${result.direction.padEnd(4)} ${result.migrationName}`);
    }
    if (results.length === 0) console.info('Nenhuma migration a executar.');
    if (error !== undefined) throw error;
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
