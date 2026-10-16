import type { InstantRange, Sort } from '../../../../shared-kernel/domain';
import type { OrderStatusValue } from '../value-objects/order-status';

export const ORDER_SORT_FIELDS = ['createdAt', 'totalAmount'] as const;

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

export type OrderListCriteria = {
  readonly offset: number;
  readonly limit: number;
  readonly status: OrderStatusValue | null;
  /** Instantes `[from, to)` da criação do pedido; `null` em uma ponta = sem limite. */
  readonly createdAt: InstantRange;
  /** Desempate sempre pelo ID, para a paginação ser estável. */
  readonly sort: Sort<OrderSortField>;
};
