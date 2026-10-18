import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { buildOrder } from '../../../domain/order/testing/order.fixture';
import { FakeOrderGateway } from '../../testing/fake-order.gateway';
import { ListOrdersUseCase } from './list-orders.usecase';

describe('ListOrdersUseCase', () => {
  it('consulta com os filtros validados e devolve pedidos prontos para a tela', async () => {
    const gateway = new FakeOrderGateway();
    gateway.orders = [buildOrder({ status: 'ready' })];

    const page = await new ListOrdersUseCase(gateway).execute({ status: 'ready', page: 1 });

    expect(gateway.listCalls[0]).toMatchObject({ status: 'ready', page: 1, limit: 20 });
    expect(page.pagination.total).toBe(1);
    expect(page.data[0]).toMatchObject({
      status: 'ready',
      totalCents: 7830,
      itemCount: 3,
      transitions: [
        { to: 'delivering', blockedBy: 'DELIVERY_PERSON_REQUIRED' },
        { to: 'cancelled', blockedBy: null },
      ],
    });
    expect(page.data[0]?.items[0]).toMatchObject({ unitPriceCents: 3290, subtotalCents: 6580 });
  });

  it('filtro inválido não chega à API', async () => {
    const gateway = new FakeOrderGateway();

    await expect(
      new ListOrdersUseCase(gateway).execute({ startDate: '2026-10-17', endDate: '2026-10-01' }),
    ).rejects.toThrow(InputValidationError);
    expect(gateway.listCalls).toHaveLength(0);
  });
});
