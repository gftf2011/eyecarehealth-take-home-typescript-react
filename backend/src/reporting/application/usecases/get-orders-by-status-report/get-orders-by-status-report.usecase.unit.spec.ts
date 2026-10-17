import { beforeEach, describe, expect, it } from 'vitest';

import { FakeOrdersByStatusQuery } from '../../testing/fake-report-queries';
import { GetOrdersByStatusReportUseCase } from './get-orders-by-status-report.usecase';

describe('GetOrdersByStatusReportUseCase', () => {
  let query: FakeOrdersByStatusQuery;
  let getOrdersByStatus: GetOrdersByStatusReportUseCase;

  beforeEach(() => {
    query = new FakeOrdersByStatusQuery();
    getOrdersByStatus = new GetOrdersByStatusReportUseCase(query);
  });

  it('traz os 6 status na ordem do fluxo, com zero onde não há pedidos, e o total', async () => {
    query.rows = [
      { status: 'delivered', count: 284 },
      { status: 'pending', count: 15 },
    ];

    expect(await getOrdersByStatus.execute({})).toEqual({
      data: [
        { status: 'pending', count: 15 },
        { status: 'preparing', count: 0 },
        { status: 'ready', count: 0 },
        { status: 'delivering', count: 0 },
        { status: 'delivered', count: 284 },
        { status: 'cancelled', count: 0 },
      ],
      total: 299,
    });
  });

  it('período opcional pela criação do pedido', async () => {
    await getOrdersByStatus.execute({});
    await getOrdersByStatus.execute({ startDate: '2025-01-10' });

    expect(query.calls).toEqual([
      { from: null, to: null },
      { from: new Date('2025-01-10T03:00:00.000Z'), to: null },
    ]);
  });

  it('rejeita data inválida', async () => {
    await expect(getOrdersByStatus.execute({ endDate: 'ontem' })).rejects.toMatchObject({
      details: [{ field: 'endDate' }],
    });
  });
});
