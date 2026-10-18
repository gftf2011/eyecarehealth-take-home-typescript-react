import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { afterEach, describe, expect, it } from 'vitest';

import { SystemClock } from '../../clock/system-clock';
import { SqsDeadLetterQueue } from './sqs-dead-letter-queue';
import { SqsQueueConsumer, type QueueMessage } from './sqs-queue-consumer';
import { createTestMessaging, type TestMessaging } from './testing/test-aws';

let consumer: SqsQueueConsumer | null = null;

afterEach(async () => {
  await consumer?.stop();
  consumer = null;
});

async function send(messaging: TestMessaging, body: string): Promise<void> {
  await messaging.sqs.send(new SendMessageCommand({ QueueUrl: messaging.queue.url, MessageBody: body }));
}

function consume(messaging: TestMessaging, handle: (message: QueueMessage) => Promise<void>, errors: unknown[] = []) {
  consumer = new SqsQueueConsumer(messaging.sqs, {
    queueUrl: messaging.queue.url,
    handle,
    onError: (error) => errors.push(error),
    clock: new SystemClock(),
    waitTimeSeconds: 1,
  });
  consumer.start();
  return consumer;
}

describe('SqsQueueConsumer e fila morta (Floci)', () => {
  it('processa e apaga: a mensagem não volta', async () => {
    const messaging = await createTestMessaging();
    const handled: string[] = [];
    await send(messaging, 'a');
    await send(messaging, 'b');

    const running = consume(messaging, async (message) => void handled.push(message.body));

    await expect.poll(() => [...handled].sort()).toEqual(['a', 'b']);
    expect(running.isAlive(5_000)).toBe(true);
    // Passa o visibility timeout (1 s): apagadas, não reaparecem.
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(handled).toHaveLength(2);
  });

  it('falha no processamento: a mensagem volta e, no limite de recebimentos, vai para a fila morta', async () => {
    const messaging = await createTestMessaging({ maxReceiveCount: 2 });
    const attempts: number[] = [];
    const errors: unknown[] = [];
    await send(messaging, 'veneno');

    consume(
      messaging,
      async (message) => {
        attempts.push(message.receiveCount);
        throw new Error('Redis fora');
      },
      errors,
    );

    const deadLetters = new SqsDeadLetterQueue(messaging.sqs, messaging.deadLetterQueue, messaging.queue);
    await expect.poll(() => deadLetters.count(), { timeout: 15_000, interval: 500 }).toBe(1);
    expect(attempts).toEqual([1, 2]);
    expect(errors).toHaveLength(2);
    expect((await deadLetters.peek()).map((message) => message.body)).toEqual(['veneno']);
  });

  it('redrive devolve as mortas à fila, e o consumidor as processa', async () => {
    const messaging = await createTestMessaging({ maxReceiveCount: 1 });
    let broken = true;
    const handled: string[] = [];
    await send(messaging, 'volta');

    consume(messaging, async (message) => {
      if (broken) throw new Error('Redis fora');
      handled.push(message.body);
    });
    const deadLetters = new SqsDeadLetterQueue(messaging.sqs, messaging.deadLetterQueue, messaging.queue);
    await expect.poll(() => deadLetters.count(), { timeout: 15_000, interval: 500 }).toBe(1);

    broken = false;
    expect(await deadLetters.redrive()).toEqual({ status: 'COMPLETED', moved: 1 });

    await expect.poll(() => handled, { timeout: 10_000 }).toEqual(['volta']);
    expect(await deadLetters.count()).toBe(0);
  });

  it('stop interrompe a espera do long polling na hora', async () => {
    const messaging = await createTestMessaging();
    const running = new SqsQueueConsumer(messaging.sqs, {
      queueUrl: messaging.queue.url,
      handle: async () => undefined,
      onError: () => undefined,
      clock: new SystemClock(),
      waitTimeSeconds: 20,
    });
    running.start();
    // Vivo já no boot, antes de a primeira espera de 20 s terminar.
    expect(running.isAlive(5_000)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const started = Date.now();
    await running.stop();

    expect(Date.now() - started).toBeLessThan(2_000);
    expect(running.isAlive(60_000)).toBe(false);
  });
});
