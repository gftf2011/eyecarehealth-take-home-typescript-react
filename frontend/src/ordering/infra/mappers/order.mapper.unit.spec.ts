import { describe, expect, it } from 'vitest';

import { orderBody } from '../../domain/order/testing/order.fixture';
import { orderSchema, toOrder } from './order.mapper';

describe('order.mapper', () => {
  it('converte o corpo da API no agregado (reais → centavos, ISO → Date)', () => {
    const order = toOrder(orderSchema.parse(orderBody({ status: 'ready', totalAmount: 0.3 })));

    expect(order.status.value).toBe('ready');
    expect(order.totalAmount.cents).toBe(30);
    expect(order.items[0]).toMatchObject({ productName: 'X-Burger Especial', quantity: 2 });
    expect(order.items[0]?.unitPrice.cents).toBe(3290);
    expect(order.createdAt.toISOString()).toBe('2026-10-17T15:30:00.000Z');
  });

  it('o schema recusa respostas fora do contrato', () => {
    expect(orderSchema.safeParse({ ...orderBody(), createdAt: 'ontem' }).success).toBe(false);
    expect(orderSchema.safeParse({ ...orderBody(), items: [{ quantity: 0 }] }).success).toBe(false);
  });

  it('status desconhecido vindo da API é erro (não vira um botão inválido)', () => {
    expect(() => toOrder(orderSchema.parse({ ...orderBody(), status: 'shipped' }))).toThrow('O status deve ser');
  });
});
