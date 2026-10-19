import { describe, expect, it } from 'vitest';

import type {
  ReleaseDeliveryPersonOrdersInput,
  ReleaseDeliveryPersonOrdersResult,
} from '../../application/usecases/release-delivery-person-orders/release-delivery-person-orders.usecase';
import { DeliveryPersonUpdatesConsumer } from './delivery-person-updates.consumer';

const COURIER_ID = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

function setup() {
  const calls: ReleaseDeliveryPersonOrdersInput[] = [];
  const consumer = new DeliveryPersonUpdatesConsumer({
    execute: async (input): Promise<ReleaseDeliveryPersonOrdersResult> => {
      calls.push(input);
      return { releasedOrderIds: ['order-1'] };
    },
  });
  return { consumer, calls };
}

/** Envelope como o relay publica (o mesmo corpo que chega à fila). */
function envelope(payload: Record<string, unknown>, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'evt-1',
    topic: 'delivery.delivery-person-updates',
    version: 1,
    aggregateId: COURIER_ID,
    occurredAt: '2026-10-19T12:00:00.000Z',
    payload: { deliveryPersonId: COURIER_ID, occurredAt: '2026-10-19T12:00:00.000Z', ...payload },
    ...overrides,
  });
}

describe('DeliveryPersonUpdatesConsumer', () => {
  it.each([
    ['desativado', { type: 'delivery-person.activation-changed', isActive: false }],
    ['removido', { type: 'delivery-person.removed' }],
  ])('entregador %s: confere e libera os pedidos dele', async (_, payload) => {
    const { consumer, calls } = setup();

    const result = await consumer.handle(envelope(payload));

    expect(calls).toEqual([{ deliveryPersonId: COURIER_ID }]);
    expect(result).toEqual({ outcome: 'checked', releasedOrderIds: ['order-1'] });
  });

  it.each([
    ['reativado', { type: 'delivery-person.activation-changed', isActive: true }],
    ['cadastrado', { type: 'delivery-person.registered' }],
    ['editado', { type: 'delivery-person.updated' }],
    ['mudou de lugar', { type: 'delivery-person.relocated' }],
    ['tipo novo do Delivery', { type: 'delivery-person.algo-novo' }],
  ])('entregador %s: ignora', async (_, payload) => {
    const { consumer, calls } = setup();

    expect(await consumer.handle(envelope(payload))).toEqual({ outcome: 'ignored' });
    expect(calls).toEqual([]);
  });

  it.each([
    ['não é JSON', '{'],
    ['outro tópico', envelope({ type: 'delivery-person.removed' }, { topic: 'catalog.product-updates' })],
    ['versão desconhecida do contrato', envelope({ type: 'delivery-person.removed' }, { version: 2 })],
    ['sem o id do entregador', envelope({ type: 'delivery-person.removed', deliveryPersonId: undefined })],
  ])('%s: lança (a mensagem volta e, no limite, vai para a fila morta)', async (_, body) => {
    const { consumer, calls } = setup();

    await expect(consumer.handle(body)).rejects.toThrow(Error);
    expect(calls).toEqual([]);
  });
});
