/**
 * CLI da fila morta do outbox.
 *   npm run outbox:dead-letters               lista as mensagens mortas
 *   npm run outbox:redrive -- --all           devolve todas à fila
 *   npm run outbox:redrive -- --id <uuid> ... devolve só as indicadas
 *
 * Devolver só faz sentido depois de corrigir a causa (veja `lastError`): a
 * mensagem volta com as tentativas zeradas e o relay a publica no próximo ciclo.
 */
import { parseArgs } from 'node:util';

import { createKysely, createPostgresPool } from '../shared-kernel/infra/database/postgres';
import { OutboxDeadLetters } from '../shared-kernel/infra/outbox/outbox-dead-letters';
import type { OutboxDatabase } from '../shared-kernel/infra/outbox/outbox-events.table';

const USAGE = 'Uso: outbox-redrive list | outbox-redrive redrive (--all | --id <uuid> [--id <uuid> ...])';

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { all: { type: 'boolean', default: false }, id: { type: 'string', multiple: true } },
  });
  const command = positionals[0] ?? 'list';
  const ids = values.id ?? [];
  if (command !== 'list' && command !== 'redrive') throw new Error(USAGE);
  if (command === 'redrive' && values.all === ids.length > 0) throw new Error(USAGE);

  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString === '') throw new Error('DATABASE_URL não definida');

  const db = createKysely<OutboxDatabase>(createPostgresPool(connectionString));
  try {
    const deadLetters = new OutboxDeadLetters(db);
    if (command === 'list') {
      const messages = await deadLetters.list();
      if (messages.length === 0) console.info('Fila morta vazia.');
      for (const message of messages) {
        console.info(
          `${message.id}  ${message.topic}  ${message.aggregateType}:${message.aggregateId}  ` +
            `${message.attempts} tentativas  morta em ${message.deadLetteredAt.toISOString()}\n  ${message.lastError ?? ''}`,
        );
      }
      return;
    }
    const count = await deadLetters.redrive(values.all ? undefined : ids);
    console.info(`${count} mensagem(ns) devolvida(s) à fila.`);
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
