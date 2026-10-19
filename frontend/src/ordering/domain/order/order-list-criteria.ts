import type { DatePeriod, Sort } from '../../../shared-kernel/domain';
import type { OrderStatusValue } from './value-objects/order-status';

/** Campos de ordenação aceitos pela API. */
export const ORDER_SORT_FIELDS = ['createdAt', 'totalAmount'] as const;

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

/** Filtros, ordenação e página da listagem de pedidos, já validados. */
export type OrderListCriteria = {
  /** Cursor opaco da API; `null` = primeira página. Só vale com a mesma ordenação. */
  readonly cursor: string | null;
  readonly limit: number;
  readonly status: OrderStatusValue | null;
  /** Dias locais (São Paulo) de criação do pedido, pontas inclusivas. */
  readonly createdOn: DatePeriod;
  readonly sort: Sort<OrderSortField>;
};
