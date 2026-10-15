import type { InstantRange } from '../../period/value-objects/report-period.js';

export type ProductSalesRow = {
  readonly productId: string;
  readonly productName: string;
  readonly totalQuantity: number;
  /** Soma de `unit_price × quantity` (preço congelado no pedido), em centavos. */
  readonly totalRevenueCents: number;
};

/**
 * Port de leitura: vendas por produto considerando só pedidos `delivered`
 * entregues em `range`. Pode já vir ordenado e limitado pelo banco; o
 * relatório reaplica a ordenação para garantir o desempate determinístico.
 */
export interface TopProductsQuery {
  salesByProduct(range: InstantRange, limit: number): Promise<readonly ProductSalesRow[]>;
}
