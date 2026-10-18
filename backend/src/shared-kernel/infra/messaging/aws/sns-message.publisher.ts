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
  /** Faixas em paralelo (cada uma envia em sequência). Padrão: 5. */
  readonly concurrency?: number;
};

type Entry = {
  readonly message: PublishedMessage;
  readonly group: string;
  readonly request: PublishBatchRequestEntry;
  readonly bytes: number;
};

/**
 * Publica no tópico SNS **FIFO** de eventos, em lotes (`PublishBatch`):
 * - `MessageGroupId` = agregado (pedido, produto): ordem garantida por
 *   agregado, e agregados diferentes saem em paralelo;
 * - `MessageDeduplicationId` = id do outbox: se o relay publicar de novo (o
 *   commit falhou depois do envio), o SNS descarta a repetida em 5 minutos.
 *
 * Para a ordem valer também entre chamadas, cada agregado fica numa só
 * **faixa** (enviada em sequência; as faixas correm em paralelo), cada
 * `PublishBatch` leva no máximo uma mensagem por agregado, e uma falha adia
 * (`deferred`) as seguintes do mesmo agregado.
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
    const lanes = Array.from({ length: Math.max(1, this.#concurrency) }, () => new Map<string, Entry[]>());
    for (const message of messages) {
      const entry = toEntry(message);
      const lane = lanes[laneOf(entry.group, lanes.length)];
      const queue = lane?.get(entry.group);
      if (queue === undefined) lane?.set(entry.group, [entry]);
      else queue.push(entry);
    }

    const state: { brokerDown: string | null } = { brokerDown: null };
    await Promise.all(lanes.filter((lane) => lane.size > 0).map((lane) => this.#drain(lane, outcomes, state)));

    return messages.map(
      (message) => outcomes.get(message.id) ?? { id: message.id, status: 'broker-unavailable', reason: 'sem resposta' },
    );
  }

  /** Lança se o tópico não existir ou o SNS não responder (boot e health check). */
  async ping(): Promise<void> {
    await this.sns.send(new GetTopicAttributesCommand({ TopicArn: this.topicArn }));
  }

  /**
   * Esvazia uma faixa: a cada rodada, a próxima mensagem de cada agregado
   * (até 10 e 256 KiB) num `PublishBatch`. Um agregado que falha para ali, e
   * as seguintes dele ficam adiadas (`deferred`).
   */
  async #drain(
    lane: Map<string, Entry[]>,
    outcomes: Map<string, PublishOutcome>,
    state: { brokerDown: string | null },
  ): Promise<void> {
    const stopGroup = (group: string): void => {
      for (const later of lane.get(group) ?? []) {
        outcomes.set(later.message.id, {
          id: later.message.id,
          status: 'deferred',
          reason: 'aguarda uma anterior do mesmo agregado',
        });
      }
      lane.delete(group);
    };

    while (lane.size > 0) {
      if (state.brokerDown !== null) {
        for (const queue of lane.values()) {
          for (const { message } of queue) {
            outcomes.set(message.id, { id: message.id, status: 'broker-unavailable', reason: state.brokerDown });
          }
        }
        lane.clear();
        return;
      }

      const round: Entry[] = [];
      let bytes = 0;
      for (const [group, queue] of [...lane]) {
        const head = queue[0];
        if (head === undefined) {
          lane.delete(group);
          continue;
        }
        // Sozinha já passa do limite: o SNS recusaria; nem adianta enviar.
        if (head.bytes > SNS_MAX_BATCH_BYTES) {
          queue.shift();
          outcomes.set(head.message.id, {
            id: head.message.id,
            status: 'rejected',
            reason: `Mensagem de ${head.bytes} bytes passa do limite do SNS (${SNS_MAX_BATCH_BYTES})`,
          });
          stopGroup(group);
          continue;
        }
        if (round.length === SNS_MAX_BATCH_ENTRIES || bytes + head.bytes > SNS_MAX_BATCH_BYTES) break;
        queue.shift();
        if (queue.length === 0) lane.delete(group);
        round.push(head);
        bytes += head.bytes;
      }
      if (round.length === 0) continue;

      // `#send` devolve os resultados na ordem das entradas.
      const results = await this.#send(round);
      results.forEach((outcome, index) => {
        outcomes.set(outcome.id, outcome);
        if (outcome.status === 'broker-unavailable') state.brokerDown = outcome.reason;
        const group = round[index]?.group;
        if (outcome.status !== 'published' && group !== undefined) stopGroup(group);
      });
    }
  }

  /** Um `PublishBatch` (no máximo uma mensagem por agregado); recusado inteiro, reenvia uma a uma. */
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
  const group = `${message.aggregateType}:${message.aggregateId}`;
  const request: PublishBatchRequestEntry = {
    // O id do outbox (UUID) é único no lote e aceito pelo SNS como Id.
    Id: message.id,
    Message: body,
    MessageGroupId: group,
    MessageDeduplicationId: message.id,
    MessageAttributes: { [TOPIC_ATTRIBUTE]: { DataType: 'String', StringValue: message.topic } },
  };
  // O limite do SNS soma corpo e atributos (nome, tipo e valor).
  const bytes =
    Buffer.byteLength(body) + Buffer.byteLength(TOPIC_ATTRIBUTE) + Buffer.byteLength('String') + Buffer.byteLength(message.topic);
  return { message, group, request, bytes };
}

/** Mesma faixa para o mesmo agregado, sempre. */
function laneOf(group: string, lanes: number): number {
  let hash = 0;
  for (let index = 0; index < group.length; index += 1) hash = (hash * 31 + group.charCodeAt(index)) | 0;
  return Math.abs(hash) % lanes;
}

