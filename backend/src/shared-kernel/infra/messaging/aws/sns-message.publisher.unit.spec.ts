import { PublishBatchCommand, type PublishBatchCommandOutput, type SNSClient } from '@aws-sdk/client-sns';
import { describe, expect, it } from 'vitest';

import type { PublishedMessage } from '../../../application';
import { SNS_MAX_BATCH_BYTES, SnsMessagePublisher } from './sns-message.publisher';

/** Mensagem `n` do pedido `order` (por padrão, cada mensagem num pedido próprio). */
function message(n: number, payload: PublishedMessage['payload'] = { n }, order = `order-${n}`): PublishedMessage {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    topic: 'ordering.order-updates',
    version: 1,
    aggregateType: 'ordering.order',
    aggregateId: order,
    payload,
    occurredAt: new Date('2025-01-20T12:00:00Z'),
  };
}

type Batch = { ids: string[]; groups: string[]; dedupIds: string[] };

/** SNS falso: registra cada `PublishBatch` e responde como o teste mandar. */
class FakeSns {
  readonly batches: Batch[] = [];
  inFlight = 0;
  maxInFlight = 0;
  respond: (ids: string[]) => Promise<Partial<PublishBatchCommandOutput>> = async (ids) => ({
    Successful: ids.map((Id) => ({ Id, MessageId: `sns-${Id}` })),
    Failed: [],
  });

  async send(command: unknown): Promise<unknown> {
    if (!(command instanceof PublishBatchCommand)) throw new Error('comando inesperado');
    const entries = command.input.PublishBatchRequestEntries ?? [];
    const ids = entries.map((entry) => entry.Id ?? '');
    this.batches.push({
      ids,
      groups: entries.map((entry) => entry.MessageGroupId ?? ''),
      dedupIds: entries.map((entry) => entry.MessageDeduplicationId ?? ''),
    });
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return await this.respond(ids);
    } finally {
      this.inFlight -= 1;
    }
  }
}

function publisherWith(sns: FakeSns, concurrency?: number): SnsMessagePublisher {
  return new SnsMessagePublisher(sns as unknown as SNSClient, 'arn:aws:sns:us-east-1:000000000000:eventos', {
    ...(concurrency !== undefined && { concurrency }),
  });
}

const named = (error: string) => Object.assign(new Error(error), { name: error });

describe('SnsMessagePublisher.publishBatch', () => {
  it('cada mensagem leva o agregado como grupo FIFO e o id do outbox como deduplicação', async () => {
    const sns = new FakeSns();

    await publisherWith(sns).publishBatch([message(0)]);

    expect(sns.batches).toEqual([
      { ids: [message(0).id], groups: ['ordering.order:order-0'], dedupIds: [message(0).id] },
    ]);
  });

  it('divide em lotes de até 10 e devolve um resultado por mensagem, na ordem', async () => {
    const sns = new FakeSns();
    const messages = Array.from({ length: 25 }, (_, n) => message(n));

    const outcomes = await publisherWith(sns, 1).publishBatch(messages);

    expect(sns.batches.map((batch) => batch.ids.length)).toEqual([10, 10, 5]);
    expect(outcomes.map((outcome) => outcome.id)).toEqual(messages.map((m) => m.id));
    expect(outcomes.every((outcome) => outcome.status === 'published')).toBe(true);
  });

  it('respeita o limite de 256 KiB por chamada, mesmo com menos de 10 mensagens', async () => {
    const sns = new FakeSns();
    const big = (n: number) => message(n, { blob: 'x'.repeat(100 * 1024) });

    await publisherWith(sns, 1).publishBatch([big(0), big(1), big(2)]);

    expect(sns.batches.map((batch) => batch.ids.length)).toEqual([2, 1]);
  });

  it('mensagem que sozinha passa do limite é recusada sem ir ao SNS', async () => {
    const sns = new FakeSns();

    const [tooLarge, ok] = await publisherWith(sns).publishBatch([
      message(0, { blob: 'x'.repeat(SNS_MAX_BATCH_BYTES) }),
      message(1),
    ]);

    expect(tooLarge).toMatchObject({ status: 'rejected', reason: expect.stringContaining('limite do SNS') });
    expect(ok).toMatchObject({ id: message(1).id, status: 'published' });
    expect(sns.batches.map((batch) => batch.ids)).toEqual([[message(1).id]]);
  });

  it('falha de uma entrada: culpa da mensagem é recusa, culpa do SNS é transitória', async () => {
    const sns = new FakeSns();
    sns.respond = async ([first, second, third]) => ({
      Successful: [{ Id: first }],
      Failed: [
        { Id: second, Code: 'InvalidParameter', Message: 'atributo inválido', SenderFault: true },
        { Id: third, Code: 'InternalError', Message: 'tente de novo', SenderFault: false },
      ],
    });

    const outcomes = await publisherWith(sns, 1).publishBatch([message(0), message(1), message(2)]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['published', 'rejected', 'broker-unavailable']);
    expect(outcomes[1]).toMatchObject({ reason: 'InvalidParameter: atributo inválido' });
  });

  it('SNS fora: o lote todo é transitório e os lotes seguintes nem são enviados', async () => {
    const sns = new FakeSns();
    sns.respond = async () => Promise.reject(named('TimeoutError'));

    const outcomes = await publisherWith(sns, 1).publishBatch(Array.from({ length: 30 }, (_, n) => message(n)));

    expect(sns.batches).toHaveLength(1);
    expect(outcomes.every((outcome) => outcome.status === 'broker-unavailable')).toBe(true);
  });

  it('lote recusado inteiro é reenviado mensagem a mensagem, para recusar só a culpada', async () => {
    const sns = new FakeSns();
    const culprit = message(1).id;
    sns.respond = async (ids) => {
      if (ids.includes(culprit)) throw named('InvalidParameterException');
      return { Successful: ids.map((Id) => ({ Id })), Failed: [] };
    };

    const outcomes = await publisherWith(sns, 1).publishBatch([message(0), message(1), message(2)]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['published', 'rejected', 'published']);
    expect(sns.batches.map((batch) => batch.ids.length)).toEqual([3, 1, 1, 1]);
  });

  it('envia várias faixas em paralelo, até o limite de concorrência', async () => {
    const sns = new FakeSns();

    await publisherWith(sns, 3).publishBatch(Array.from({ length: 100 }, (_, n) => message(n)));

    expect(sns.batches.flatMap((batch) => batch.ids)).toHaveLength(100);
    expect(sns.maxInFlight).toBe(3);
  });

  describe('ordem FIFO por agregado', () => {
    const ofOrder = (order: string, ...ns: number[]) => ns.map((n) => message(n, { n }, order));

    it('mensagens do mesmo pedido saem em chamadas separadas, na ordem, e nunca em paralelo', async () => {
      const sns = new FakeSns();
      const messages = [...ofOrder('A', 1, 2, 3), ...ofOrder('B', 4, 5)];

      const outcomes = await publisherWith(sns, 5).publishBatch(messages);

      expect(outcomes.every((outcome) => outcome.status === 'published')).toBe(true);
      // Nenhum PublishBatch leva duas mensagens do mesmo pedido.
      for (const batch of sns.batches) expect(new Set(batch.groups).size).toBe(batch.groups.length);
      const sentOf = (group: string) =>
        sns.batches.flatMap((batch) => batch.ids.filter((_, index) => batch.groups[index] === group));
      expect(sentOf('ordering.order:A')).toEqual(ofOrder('A', 1, 2, 3).map((m) => m.id));
      expect(sentOf('ordering.order:B')).toEqual(ofOrder('B', 4, 5).map((m) => m.id));
    });

    it('uma falha adia as seguintes do mesmo pedido, sem segurar os outros', async () => {
      const sns = new FakeSns();
      const [a1, a2, a3] = ofOrder('A', 1, 2, 3);
      const [b1, b2] = ofOrder('B', 4, 5);
      sns.respond = async (ids) => ({
        Successful: ids.filter((id) => id !== a2?.id).map((Id) => ({ Id })),
        Failed: ids.includes(a2?.id ?? '') ? [{ Id: a2?.id, Code: 'InvalidParameter', SenderFault: true }] : [],
      });

      const outcomes = await publisherWith(sns, 1).publishBatch([a1, a2, a3, b1, b2].filter((m) => m !== undefined));

      expect(outcomes.map((outcome) => outcome.status)).toEqual(['published', 'rejected', 'deferred', 'published', 'published']);
      expect(sns.batches.flatMap((batch) => batch.ids)).not.toContain(a3?.id);
    });

    it('lote recusado inteiro: a culpada é recusada e as seguintes dela, adiadas', async () => {
      const sns = new FakeSns();
      const [a1, a2] = ofOrder('A', 1, 2);
      const b1 = message(3, { n: 3 }, 'B');
      sns.respond = async (ids) => {
        if (ids.includes(a1?.id ?? '')) throw named('InvalidParameterException');
        return { Successful: ids.map((Id) => ({ Id })), Failed: [] };
      };

      const outcomes = await publisherWith(sns, 1).publishBatch([a1, a2, b1].filter((m) => m !== undefined));

      expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'deferred', 'published']);
    });
  });

  it('lote vazio não chama o SNS', async () => {
    const sns = new FakeSns();

    expect(await publisherWith(sns).publishBatch([])).toEqual([]);
    expect(sns.batches).toEqual([]);
  });
});
