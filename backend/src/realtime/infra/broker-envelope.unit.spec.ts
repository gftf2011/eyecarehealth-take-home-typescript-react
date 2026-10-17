import { describe, expect, it } from 'vitest';

import { toRealtimeEvent } from './broker-envelope';

describe('toRealtimeEvent', () => {
  it('converte o envelope do relay no evento do cliente', () => {
    const body = JSON.stringify({
      id: 'e1',
      topic: 'ordering.order-updates',
      version: 1,
      aggregateId: 'o1',
      occurredAt: '2025-01-20T12:00:00.000Z',
      payload: { type: 'order.placed', orderId: 'o1', totalAmount: 65.8 },
    });

    expect(toRealtimeEvent(body)).toEqual({
      id: 'e1',
      topic: 'ordering.order-updates',
      occurredAt: '2025-01-20T12:00:00.000Z',
      payload: { type: 'order.placed', orderId: 'o1', totalAmount: 65.8 },
    });
  });

  it.each(['não é json', '[]', '{"id":"e1"}', '{"id":"e1","topic":"t","occurredAt":"x","payload":[]}'])(
    'descarta mensagem fora do envelope: %s',
    (body) => {
      expect(toRealtimeEvent(body)).toBeNull();
    },
  );
});
