/**
 * CLI da fila morta do tempo real (SQS): mensagens que o gateway não
 * conseguiu repassar (Redis fora por muito tempo, envelope inválido).
 *   npm run events:dead-letters        conta e mostra até 10 mensagens
 *   npm run events:redrive             devolve todas à fila do tempo real
 *
 * Devolver só faz sentido depois de corrigir a causa: a mensagem volta à fila
 * e o gateway a repassa de novo (os painéis descartam repetidas pelo `id`).
 */
import { createSqsClient } from '../shared-kernel/infra/messaging/aws/aws-clients';
import { findQueue } from '../shared-kernel/infra/messaging/aws/messaging-topology';
import { SqsDeadLetterQueue } from '../shared-kernel/infra/messaging/aws/sqs-dead-letter-queue';
import { awsClientConfig, loadEventsDeadLettersEnv } from './config/messaging-env';

const COMMANDS = ['list', 'redrive'] as const;
type Command = (typeof COMMANDS)[number];

function parseCommand(raw: string | undefined): Command {
  const command = COMMANDS.find((candidate) => candidate === (raw ?? 'list'));
  if (command === undefined) throw new Error(`Uso: events-dead-letters <${COMMANDS.join('|')}>`);
  return command;
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv[2]);
  const env = loadEventsDeadLettersEnv();
  const sqs = createSqsClient(awsClientConfig(env));
  try {
    const [queue, deadLetterQueue] = await Promise.all([
      findQueue(sqs, env.REALTIME_QUEUE_NAME),
      findQueue(sqs, env.REALTIME_DLQ_NAME),
    ]);
    const deadLetters = new SqsDeadLetterQueue(sqs, deadLetterQueue, queue);

    if (command === 'list') {
      console.info(`${await deadLetters.count()} mensagem(ns) na fila morta ${env.REALTIME_DLQ_NAME}.`);
      for (const message of await deadLetters.peek()) {
        console.info(`${message.id}  ${message.receiveCount} recebimentos\n  ${message.body}`);
      }
      return;
    }
    const { status, moved } = await deadLetters.redrive();
    console.info(`Redrive ${status}: ${moved} mensagem(ns) devolvida(s) a ${env.REALTIME_QUEUE_NAME}.`);
  } finally {
    sqs.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
