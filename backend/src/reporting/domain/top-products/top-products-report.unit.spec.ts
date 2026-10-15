import { describe, expect, it } from 'vitest';

import { InvalidTopProductsLimitError, TopProductsLimit, TopProductsReport } from '../index.js';

const row = (productId: string, productName: string, totalQuantity: number, totalRevenueCents: number) => ({
  productId,
  productName,
  totalQuantity,
  totalRevenueCents,
});

describe('TopProductsReport', () => {
  it('ordena por quantidade e aplica o limite', () => {
    const report = TopProductsReport.build(
      [row('p1', 'Suco de Laranja', 98, 122_500), row('p2', 'X-Burger Especial', 156, 513_440), row('p3', 'Pudim', 10, 9_000)],
      TopProductsLimit.of(2),
    );

    expect(report.data.map((product) => [product.productName, product.totalQuantity])).toEqual([
      ['X-Burger Especial', 156],
      ['Suco de Laranja', 98],
    ]);
    expect(report.data[0]?.totalRevenue.toDecimal()).toBe(5134.4);
  });

  it('desempata por receita, depois por nome e por ID', () => {
    const report = TopProductsReport.build(
      [
        row('p4', 'Batata', 5, 1_000),
        row('p3', 'Açaí', 5, 1_000),
        row('p2', 'Açaí', 5, 1_000),
        row('p1', 'Zebra', 5, 2_000),
      ],
      TopProductsLimit.default(),
    );

    expect(report.data.map((product) => product.productId)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('ignora produtos sem vendas', () => {
    const report = TopProductsReport.build([row('p1', 'Pudim', 0, 0)], TopProductsLimit.default());
    expect(report.data).toEqual([]);
  });

  it('rejeita quantidade inválida do adapter', () => {
    expect(() =>
      TopProductsReport.build([row('p1', 'Pudim', -1, 0)], TopProductsLimit.default()),
    ).toThrow(RangeError);
  });
});

describe('TopProductsLimit', () => {
  it('usa 10 por padrão', () => {
    expect(TopProductsLimit.default().value).toBe(10);
  });

  it.each([0, 101, 2.5])('rejeita %d', (value) => {
    expect(() => TopProductsLimit.of(value)).toThrow(InvalidTopProductsLimitError);
  });
});
