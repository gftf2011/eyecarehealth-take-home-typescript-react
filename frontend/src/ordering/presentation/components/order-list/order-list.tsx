import { formatCents, formatDateTime } from '../../../../shared-kernel/presentation';
import type { OrderDto } from '../../../application';
import { OrderActions } from '../order-actions/order-actions';
import { OrderStatusBadge } from '../order-status-badge/order-status-badge';
import styles from './order-list.module.css';

export type OrderListProps = {
  readonly orders: readonly OrderDto[];
  readonly onOpen: (id: string) => void;
};

function itemsSummary(order: OrderDto): string {
  return order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ');
}

/** Pedidos em linhas (desktop) que viram cartões no celular. */
export function OrderList({ orders, onOpen }: OrderListProps) {
  return (
    <ul className={styles.list} aria-label="Pedidos">
      {orders.map((order) => (
        <li key={order.id} className={styles.row}>
          <button
            type="button"
            className={styles.open}
            onClick={() => onOpen(order.id)}
            aria-label={`Ver detalhes do pedido de ${order.customerName}`}
          >
            <span className={styles.customer}>{order.customerName}</span>
            <span className={styles.items} title={itemsSummary(order)}>
              {itemsSummary(order)}
            </span>
          </button>
          <span className={styles.status}>
            <OrderStatusBadge status={order.status} />
          </span>
          <span className={styles.total}>{formatCents(order.totalCents)}</span>
          <time className={styles.date} dateTime={order.createdAt.toISOString()}>
            {formatDateTime(order.createdAt)}
          </time>
          <div className={styles.actions}>
            <OrderActions order={order} compact />
          </div>
        </li>
      ))}
    </ul>
  );
}

