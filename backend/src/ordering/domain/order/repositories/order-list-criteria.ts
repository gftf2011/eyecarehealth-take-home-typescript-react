import type { InstantRange, Keyset, Sort, SortKey } from '../../../../shared-kernel/domain';
import type { Order } from '../order';
import type { OrderStatusValue } from '../value-objects/order-status';

export const ORDER_SORT_FIELDS = ['createdAt', 'totalAmount'] as const;

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

/** O valor de cada campo de ordenação que vai no cursor: epoch em ms e centavos. */
export const ORDER_SORT_KEYS: { readonly [TField in OrderSortField]: SortKey<Order> } = {
  createdAt: { kind: 'integer', of: (order) => order.createdAt.getTime() },
  totalAmount: { kind: 'integer', of: (order) => order.totalAmount.cents },
};

export type OrderListCriteria = {
  readonly limit: number;
  /** De onde a página começa; `null` = primeira página. */
  readonly keyset: Keyset | null;
  readonly status: OrderStatusValue | null;
  /** Instantes `[from, to)` da criação do pedido; `null` em uma ponta = sem limite. */
  readonly createdAt: InstantRange;
  /** Desempate pelo ID na mesma direção, para a paginação ser estável. */
  readonly sort: Sort<OrderSortField>;
};
