import { Money } from '../../../shared-kernel/domain';
import type { ProductSalesRow } from './queries/top-products.query';
import type { TopProductsLimit } from './value-objects/top-products-limit';

export type ProductSales = {
  readonly productId: string;
  readonly productName: string;
  readonly totalQuantity: number;
  readonly totalRevenue: Money;
};

/**
 * Produtos mais vendidos (somente pedidos `delivered`).
 *
 * Ranking: maior quantidade vendida; empate → maior receita; empate → nome
 * (A→Z); empate → ID. Assim o resultado é sempre o mesmo para os mesmos dados.
 */
export class TopProductsReport {
  readonly data: readonly ProductSales[];

  private constructor(data: readonly ProductSales[]) {
    this.data = Object.freeze([...data]);
  }

  static build(rows: readonly ProductSalesRow[], limit: TopProductsLimit): TopProductsReport {
    const ranked = rows
      .filter((row) => {
        if (!Number.isSafeInteger(row.totalQuantity) || row.totalQuantity < 0) {
          throw new RangeError(`Quantidade inválida para o produto ${row.productId}`);
        }
        return row.totalQuantity > 0;
      })
      .map(
        (row): ProductSales => ({
          productId: row.productId,
          productName: row.productName,
          totalQuantity: row.totalQuantity,
          totalRevenue: Money.fromCents(row.totalRevenueCents, 'totalRevenueCents'),
        }),
      )
      .sort(byRanking)
      .slice(0, limit.value);

    return new TopProductsReport(ranked);
  }
}

function byRanking(a: ProductSales, b: ProductSales): number {
  return (
    b.totalQuantity - a.totalQuantity ||
    b.totalRevenue.cents - a.totalRevenue.cents ||
    a.productName.localeCompare(b.productName, 'pt-BR') ||
    (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)
  );
}
