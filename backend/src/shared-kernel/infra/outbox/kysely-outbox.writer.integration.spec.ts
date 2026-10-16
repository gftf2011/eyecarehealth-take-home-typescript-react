import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { OutboxMessage } from '../../application';
import { connectToTestDatabase, resetDatabase } from '../database/testing/test-database';
import { KyselyOutboxWriter } from './kysely-outbox.writer';
import type { OutboxDatabase } from './outbox-events.table';

const db = connectToTestDatabase<OutboxDatabase>();

const message: OutboxMessage = {
  id: '0f1e2d3c-4b5a-4968-8776-655443322110',
  aggregateType: 'order',
  aggregateId: '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b',
  eventName: 'ordering.order.placed',
  eventVersion: 1,
  payload: { totalAmountCents: 7830, items: [{ productId: 'abc', quantity: 2 }] },
  occurredAt: new Date('2025-01-20T14:30:00Z'),
};

describe('KyselyOutboxWriter', () => {
  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('grava a mensagem com o payload em JSON, pendente de entrega', async () => {
    await db.transaction().execute((trx) => new KyselyOutboxWriter(trx).append([message]));

    const rows = await db.selectFrom('outbox_events').selectAll().execute();
    expect(rows).toEqual([
      expect.objectContaining({
        id: message.id,
        aggregate_type: 'order',
        aggregate_id: message.aggregateId,
        event_name: 'ordering.order.placed',
        event_version: 1,
        payload: message.payload,
        occurred_at: message.occurredAt,
        published_at: null,
        attempts: 0,
      }),
    ]);
  });

  it('não grava nada para lista vazia', async () => {
    await new KyselyOutboxWriter(db).append([]);

    expect(await db.selectFrom('outbox_events').selectAll().execute()).toHaveLength(0);
  });

  it('recusa a mesma mensagem duas vezes (id é a chave de idempotência)', async () => {
    const writer = new KyselyOutboxWriter(db);
    await writer.append([message]);

    await expect(writer.append([message])).rejects.toThrow(/duplicate|unique/i);
  });
});
