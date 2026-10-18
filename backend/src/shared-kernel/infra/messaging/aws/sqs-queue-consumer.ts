import { DeleteMessageBatchCommand, ReceiveMessageCommand, type Message, type SQSClient } from '@aws-sdk/client-sqs';

import type { Clock } from '../../../application';

/** Uma mensagem recebida da fila. */
export type QueueMessage = {
  readonly id: string;
  readonly body: string;
  /** Quantas vezes já foi recebida (1 na primeira). */
  readonly receiveCount: number;
};

export type SqsQueueConsumerOptions = {
  readonly queueUrl: string;
  /** Processa uma mensagem; se lançar, ela volta à fila (e, no limite, à fila morta). */
  readonly handle: (message: QueueMessage) => Promise<void>;
  /** Falhas de processamento (com a mensagem) e de leitura da fila (sem). */
  readonly onError: (error: unknown, message?: QueueMessage) => void;
  readonly clock: Clock;
  /** Long polling: espera até isto por mensagens. Padrão: 20 s (máximo do SQS). */
  readonly waitTimeSeconds?: number;
  /** Mensagens por leitura. Padrão: 10 (máximo do SQS). */
  readonly batchSize?: number;
  /** Teto da espera entre leituras que falharam. Padrão: 10 s. */
  readonly maxBackoffMs?: number;
};

const DEFAULT_WAIT_TIME_SECONDS = 20;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_BACKOFF_MS = 10_000;
const BASE_BACKOFF_MS = 500;

/**
 * Consumidor de uma fila SQS com long polling. Garantia: **pelo menos uma
 * vez** — a mensagem só é apagada depois de processada; se o processamento
 * falhar, ela reaparece após o visibility timeout, e o SQS a move para a fila
 * morta no `maxReceiveCount`. Várias réplicas dividem a fila entre si.
 *
 * `stop()` interrompe a espera em andamento, aguarda o lote atual terminar e
 * só então resolve.
 */
export class SqsQueueConsumer {
  readonly #sqs: SQSClient;
  readonly #options: Required<SqsQueueConsumerOptions>;
  #running = false;
  #loop: Promise<void> | null = null;
  #abort: AbortController | null = null;
  #lastPollAt: Date | null = null;
  #consecutiveFailures = 0;

  constructor(sqs: SQSClient, options: SqsQueueConsumerOptions) {
    this.#sqs = sqs;
    this.#options = {
      waitTimeSeconds: DEFAULT_WAIT_TIME_SECONDS,
      batchSize: DEFAULT_BATCH_SIZE,
      maxBackoffMs: DEFAULT_MAX_BACKOFF_MS,
      ...options,
    };
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#loop = this.#run();
  }

  async stop(): Promise<void> {
    this.#running = false;
    this.#abort?.abort();
    await this.#loop;
    this.#loop = null;
  }

  /** Rodando e com uma leitura bem-sucedida da fila há no máximo `maxStaleMs`. */
  isAlive(maxStaleMs: number): boolean {
    if (!this.#running || this.#lastPollAt === null) return false;
    return this.#options.clock.now().getTime() - this.#lastPollAt.getTime() <= maxStaleMs;
  }

  async #run(): Promise<void> {
    while (this.#running) {
      const messages = await this.#receive();
      if (messages === null) {
        if (this.#running) await this.#sleep(this.#backoff());
        continue;
      }
      await this.#process(messages);
    }
  }

  /** Lê um lote; `null` se a leitura falhou (fila fora, rede). */
  async #receive(): Promise<Message[] | null> {
    this.#abort = new AbortController();
    try {
      const { Messages = [] } = await this.#sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: this.#options.queueUrl,
          MaxNumberOfMessages: this.#options.batchSize,
          WaitTimeSeconds: this.#options.waitTimeSeconds,
          MessageSystemAttributeNames: ['ApproximateReceiveCount'],
        }),
        { abortSignal: this.#abort.signal },
      );
      this.#lastPollAt = this.#options.clock.now();
      this.#consecutiveFailures = 0;
      return Messages;
    } catch (error) {
      // `stop()` abortou a espera: encerramento, não falha.
      if (!this.#running) return [];
      this.#options.onError(error);
      return null;
    } finally {
      this.#abort = null;
    }
  }

  /** Processa o lote e apaga de uma vez as que deram certo. */
  async #process(messages: readonly Message[]): Promise<void> {
    const done: { Id: string; ReceiptHandle: string }[] = [];
    for (const [index, raw] of messages.entries()) {
      if (raw.ReceiptHandle === undefined) continue;
      const message: QueueMessage = {
        id: raw.MessageId ?? String(index),
        body: raw.Body ?? '',
        receiveCount: Number(raw.Attributes?.ApproximateReceiveCount ?? '1'),
      };
      try {
        await this.#options.handle(message);
        done.push({ Id: String(index), ReceiptHandle: raw.ReceiptHandle });
      } catch (error) {
        this.#options.onError(error, message);
      }
    }
    if (done.length === 0) return;
    try {
      await this.#sqs.send(new DeleteMessageBatchCommand({ QueueUrl: this.#options.queueUrl, Entries: done }));
    } catch (error) {
      // Não apagou: as mensagens voltam e saem de novo (o cliente deduplica pelo id).
      this.#options.onError(error);
    }
  }

  #backoff(): number {
    this.#consecutiveFailures += 1;
    return Math.min(BASE_BACKOFF_MS * 2 ** this.#consecutiveFailures, this.#options.maxBackoffMs);
  }

  async #sleep(ms: number): Promise<void> {
    const abort = new AbortController();
    this.#abort = abort;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      abort.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.#abort = null;
  }
}
