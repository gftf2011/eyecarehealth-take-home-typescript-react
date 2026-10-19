/**
 * CLI das filas mortas do SQS, uma por consumidor:
 * - `realtime` (padrão): mensagens que o gateway não conseguiu repassar
 *   (Redis fora por muito tempo, envelope inválido);
 * - `ordering`: mudanças da frota que o Ordering não conseguiu aplicar
 *   (banco fora por muito tempo, contrato incompatível).
 *
 *   npm run events:dead-letters [-- ordering]   conta e mostra até 10 mensagens
 *   npm run events:redrive [-- ordering]        devolve todas à fila de origem
 *
 * Devolver só faz sentido depois de corrigir a causa: a mensagem volta à fila
 * e é processada de novo (painéis e Ordering toleram repetidas).
 */
import { createSqsClient } from '../shared-kernel/infra/messaging/aws/aws-clients';
import { findQueue } from '../shared-kernel/infra/messaging/aws/messaging-topology';
import { SqsDeadLetterQueue } from '../shared-kernel/infra/messaging/aws/sqs-dead-letter-queue';
import { awsClientConfig, loadEventsDeadLettersEnv } from './config/messaging-env';

const COMMANDS = ['list', 'redrive'] as const;
type Command = (typeof COMMANDS)[number];

const CONSUMERS = ['realtime', 'ordering'] as const;
type Consumer = (typeof CONSUMERS)[number];

function parseConsumer(raw: string | undefined): Consumer {
  const consumer = CONSUMERS.find((candidate) => candidate === (raw ?? 'realtime'));
  if (consumer === undefined) throw new Error(`Fila desconhecida: use ${CONSUMERS.join(' ou ')}`);
  return consumer;
}

function parseCommand(raw: string | undefined): Command {
  const command = COMMANDS.find((candidate) => candidate === (raw ?? 'list'));
  if (command === undefined) throw new Error(`Uso: events-dead-letters <${COMMANDS.join('|')}>`);
  return command;
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv[2]);
  const consumer = parseConsumer(process.argv[3]);
  const env = loadEventsDeadLettersEnv();
  const names =
    consumer === 'realtime'
      ? { queue: env.REALTIME_QUEUE_NAME, deadLetters: env.REALTIME_DLQ_NAME }
      : { queue: env.ORDERING_QUEUE_NAME, deadLetters: env.ORDERING_DLQ_NAME };
  const sqs = createSqsClient(awsClientConfig(env));
  try {
    const [queue, deadLetterQueue] = await Promise.all([findQueue(sqs, names.queue), findQueue(sqs, names.deadLetters)]);
    const deadLetters = new SqsDeadLetterQueue(sqs, deadLetterQueue, queue);

    if (command === 'list') {
      console.info(`${await deadLetters.count()} mensagem(ns) na fila morta ${names.deadLetters}.`);
      for (const message of await deadLetters.peek()) {
        console.info(`${message.id}  ${message.receiveCount} recebimentos\n  ${message.body}`);
      }
      return;
    }
    const { status, moved } = await deadLetters.redrive();
    console.info(`Redrive ${status}: ${moved} mensagem(ns) devolvida(s) a ${names.queue}.`);
  } finally {
    sqs.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
