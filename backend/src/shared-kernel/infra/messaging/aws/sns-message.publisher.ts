import {
  GetTopicAttributesCommand,
  PublishBatchCommand,
  type PublishBatchRequestEntry,
  type SNSClient,
} from '@aws-sdk/client-sns';

import type { MessagePublisher, PublishedMessage, PublishOutcome } from '../../../application';
import { toMessageEnvelope } from '../message-envelope';

/** Atributo SNS com o tópico lógico: filtra o que cada fila assinante recebe. */
export const TOPIC_ATTRIBUTE = 'topic';

/** Limites do `PublishBatch` do SNS: 10 mensagens e 256 KiB somadas, por chamada. */
export const SNS_MAX_BATCH_ENTRIES = 10;
export const SNS_MAX_BATCH_BYTES = 256 * 1024;

/**
 * Recusas que dependem da mensagem (tamanho, atributos inválidos): repetir
 * não adianta. Todo o resto — rede, throttling, 5xx, credenciais, tópico
 * inexistente — é falha do broker, transitória.
 */
const MESSAGE_REJECTIONS: ReadonlySet<string> = new Set([
  'InvalidParameterException',
  'InvalidParameterValueException',
  'ValidationException',
  'BatchRequestTooLongException',
]);

export type SnsMessagePublisherOptions = {
  /** Chamadas `PublishBatch` em paralelo. Padrão: 5 (50 mensagens por vez). */
  readonly concurrency?: number;
};

type Entry = { readonly message: PublishedMessage; readonly request: PublishBatchRequestEntry; readonly bytes: number };

/**
 * Publica no tópico SNS de eventos da aplicação, em lotes (`PublishBatch`):
 * um lote do outbox de 100 mensagens vira 10 chamadas em vez de 100, várias
 * em paralelo. Cada fila assinante recebe sua cópia, com retentativa e fila
 * morta próprias.
 */
export class SnsMessagePublisher implements MessagePublisher {
  readonly #concurrency: number;

  constructor(
    private readonly sns: SNSClient,
    private readonly topicArn: string,
    { concurrency = 5 }: SnsMessagePublisherOptions = {},
  ) {
    this.#concurrency = concurrency;
  }

  async publishBatch(messages: readonly PublishedMessage[]): Promise<readonly PublishOutcome[]> {
    const outcomes = new Map<string, PublishOutcome>();
    const entries: Entry[] = [];
    for (const message of messages) {
      const entry = toEntry(message);
      // Sozinha já passa do limite: o SNS recusaria; nem adianta enviar.
      if (entry.bytes > SNS_MAX_BATCH_BYTES) {
        outcomes.set(message.id, { id: message.id, status: 'rejected', reason: `Mensagem de ${entry.bytes} bytes passa do limite do SNS (${SNS_MAX_BATCH_BYTES})` });
      } else {
        entries.push(entry);
      }
    }

    const chunks = chunk(entries);
    let brokerDown: string | null = null;
    let next = 0;
    const worker = async (): Promise<void> => {
      for (let index = next++; index < chunks.length; index = next++) {
        const current = chunks[index] ?? [];
        // Broker fora num lote: os que ainda não saíram nem tentam.
        if (brokerDown !== null) {
          for (const { message } of current) outcomes.set(message.id, { id: message.id, status: 'broker-unavailable', reason: brokerDown });
          continue;
        }
        for (const outcome of await this.#send(current)) {
          outcomes.set(outcome.id, outcome);
          if (outcome.status === 'broker-unavailable') brokerDown = outcome.reason;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.#concurrency, chunks.length) }, worker));

    return messages.map(
      (message) => outcomes.get(message.id) ?? { id: message.id, status: 'broker-unavailable', reason: 'sem resposta' },
    );
  }

  /** Lança se o tópico não existir ou o SNS não responder (boot e health check). */
  async ping(): Promise<void> {
    await this.sns.send(new GetTopicAttributesCommand({ TopicArn: this.topicArn }));
  }

  /** Um `PublishBatch`; um lote recusado inteiro é reenviado mensagem a mensagem, para achar a culpada. */
  async #send(entries: readonly Entry[]): Promise<PublishOutcome[]> {
    try {
      const { Successful = [], Failed = [] } = await this.sns.send(
        new PublishBatchCommand({ TopicArn: this.topicArn, PublishBatchRequestEntries: entries.map((entry) => entry.request) }),
      );
      const failed = new Map(Failed.map((failure) => [failure.Id, failure]));
      const succeeded = new Set(Successful.map((success) => success.Id));
      return entries.map(({ message }): PublishOutcome => {
        const failure = failed.get(message.id);
        if (failure === undefined) {
          return succeeded.has(message.id)
            ? { id: message.id, status: 'published' }
            : { id: message.id, status: 'broker-unavailable', reason: 'ausente da resposta do SNS' };
        }
        const reason = `${failure.Code ?? 'Erro'}: ${failure.Message ?? ''}`.trim();
        // SenderFault: culpa da mensagem; senão, do SNS (tentar de novo).
        return failure.SenderFault === true
          ? { id: message.id, status: 'rejected', reason }
          : { id: message.id, status: 'broker-unavailable', reason };
      });
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const rejected = error instanceof Error && MESSAGE_REJECTIONS.has(error.name);
      if (!rejected) return entries.map(({ message }) => ({ id: message.id, status: 'broker-unavailable', reason }));
      if (entries.length === 1) return entries.map(({ message }) => ({ id: message.id, status: 'rejected', reason }));
      const outcomes: PublishOutcome[] = [];
      for (const entry of entries) outcomes.push(...(await this.#send([entry])));
      return outcomes;
    }
  }
}

function toEntry(message: PublishedMessage): Entry {
  const body = JSON.stringify(toMessageEnvelope(message));
  const request: PublishBatchRequestEntry = {
    // O id do outbox (UUID) é único no lote e aceito pelo SNS como Id.
    Id: message.id,
    Message: body,
    MessageAttributes: { [TOPIC_ATTRIBUTE]: { DataType: 'String', StringValue: message.topic } },
  };
  // O limite do SNS soma corpo e atributos (nome, tipo e valor).
  const bytes =
    Buffer.byteLength(body) + Buffer.byteLength(TOPIC_ATTRIBUTE) + Buffer.byteLength('String') + Buffer.byteLength(message.topic);
  return { message, request, bytes };
}

/** Lotes de até 10 mensagens e 256 KiB, na ordem original. */
function chunk(entries: readonly Entry[]): Entry[][] {
  const chunks: Entry[][] = [];
  let current: Entry[] = [];
  let bytes = 0;
  for (const entry of entries) {
    if (current.length === SNS_MAX_BATCH_ENTRIES || bytes + entry.bytes > SNS_MAX_BATCH_BYTES) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(entry);
    bytes += entry.bytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
