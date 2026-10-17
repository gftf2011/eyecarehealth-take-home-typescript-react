import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FakeTopProductsQuery } from '../../testing/fake-report-queries';
import { GetTopProductsReportUseCase } from './get-top-products-report.usecase';

const BURGER = 'a0000000-0000-4000-8000-000000000001';
const JUICE = 'a0000000-0000-4000-8000-000000000002';
const PUDDING = 'a0000000-0000-4000-8000-000000000003';

describe('GetTopProductsReportUseCase', () => {
  let query: FakeTopProductsQuery;
  let getTopProducts: GetTopProductsReportUseCase;

  beforeEach(() => {
    query = new FakeTopProductsQuery();
    getTopProducts = new GetTopProductsReportUseCase(query);
  });

  it('produtos mais vendidos: ranking por quantidade, com receita em reais', async () => {
    query.rows = [
      { productId: JUICE, productName: 'Suco de Laranja', totalQuantity: 98, totalRevenueCents: 122_500 },
      { productId: BURGER, productName: 'X-Burger Especial', totalQuantity: 156, totalRevenueCents: 513_440 },
      { productId: PUDDING, productName: 'Pudim', totalQuantity: 98, totalRevenueCents: 88_200 },
    ];

    const report = await getTopProducts.execute({});

    expect(report).toEqual({
      data: [
        { productId: BURGER, productName: 'X-Burger Especial', totalQuantity: 156, totalRevenue: 5134.4 },
        // Empate em quantidade: maior receita primeiro.
        { productId: JUICE, productName: 'Suco de Laranja', totalQuantity: 98, totalRevenue: 1225 },
        { productId: PUDDING, productName: 'Pudim', totalQuantity: 98, totalRevenue: 882 },
      ],
    });
  });

  it('padrão: top 10, sem período (todas as entregas)', async () => {
    await getTopProducts.execute({});

    expect(query.calls).toEqual([{ range: { from: null, to: null }, limit: 10 }]);
  });

  it('respeita limit e o período pela data da entrega', async () => {
    query.rows = [
      { productId: BURGER, productName: 'X-Burger Especial', totalQuantity: 5, totalRevenueCents: 16_450 },
      { productId: JUICE, productName: 'Suco de Laranja', totalQuantity: 3, totalRevenueCents: 3_750 },
    ];

    const report = await getTopProducts.execute({ startDate: '2025-01-01', endDate: '2025-01-31', limit: 1 });

    expect(report.data.map((product) => product.productName)).toEqual(['X-Burger Especial']);
    expect(query.calls[0]).toEqual({
      range: { from: new Date('2025-01-01T03:00:00.000Z'), to: new Date('2025-02-01T03:00:00.000Z') },
      limit: 1,
    });
  });

  it.each([0, 101, 2.5])('rejeita limit %s', async (limit) => {
    const attempt = getTopProducts.execute({ limit });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [{ field: 'limit', message: 'O limite deve ser um inteiro entre 1 e 100' }],
    });
  });
});
