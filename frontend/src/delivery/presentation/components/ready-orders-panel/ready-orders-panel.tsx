import { formatCents, formatDateTime } from '../../../../shared-kernel/presentation';
import type { ReadyOrder } from '../../../domain';
import { BoardPanel } from '../board-panel/board-panel';
import styles from './ready-orders-panel.module.css';

/** Pedidos prontos aguardando entregador, mais antigos primeiro. */
export function ReadyOrdersPanel({
  orders,
  hasMore,
}: {
  readonly orders: readonly ReadyOrder[];
  /** Há mais pedidos prontos que os desta página. */
  readonly hasMore: boolean;
}) {
  return (
    <BoardPanel title="Pedidos prontos" count={orders.length} empty="Nenhum pedido pronto aguardando entregador.">
      <ul className={styles.list}>
        {orders.map((order) => (
          <li key={order.id} className={styles.item}>
            <div className={styles.main}>
              <span className={styles.customer}>{order.customerName}</span>
              <span className={styles.address}>{order.deliveryAddress}</span>
            </div>
            <div className={styles.meta}>
              <span>{formatCents(order.totalCents)}</span>
              <span>
                {order.itemCount} {order.itemCount === 1 ? 'item' : 'itens'}
              </span>
              <time dateTime={order.createdAt.toISOString()}>{formatDateTime(order.createdAt)}</time>
            </div>
            {order.assignedDeliveryPersonName === null ? null : (
              <span className={styles.assigned}>Atribuído a {order.assignedDeliveryPersonName}</span>
            )}
          </li>
        ))}
      </ul>
      {hasMore ? (
        <p className={styles.more}>
          Mostrando os {orders.length} mais antigos; há mais prontos, e a sugestão considera todos.
        </p>
      ) : null}
    </BoardPanel>
  );
}
