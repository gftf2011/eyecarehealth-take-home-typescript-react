import {
  Alert,
  Dialog,
  Skeleton,
  errorMessage,
  formatCents,
  formatDateTime,
} from '../../../../shared-kernel/presentation';
import type { OrderDto } from '../../../application';
import { useOrder } from '../../hooks/use-order';
import { ORDER_STATUS_LABELS } from '../../labels/order-labels';
import { DeliveryIssuePanel } from '../delivery-issue-panel/delivery-issue-panel';
import { OrderActions } from '../order-actions/order-actions';
import { OrderStatusBadge } from '../order-status-badge/order-status-badge';
import styles from './order-details-dialog.module.css';

export type OrderDetailsDialogProps = {
  /** Pedido aberto; `null` mantém o modal fechado. */
  readonly orderId: string | null;
  readonly onClose: () => void;
};

/** Detalhe do pedido em modal: cliente, entrega, itens com preços congelados, histórico e ações. */
export function OrderDetailsDialog({ orderId, onClose }: OrderDetailsDialogProps) {
  const query = useOrder(orderId);
  const order = query.data;

  return (
    <Dialog open={orderId !== null} onClose={onClose} title="Detalhes do pedido" size="lg">
      {query.isPending ? <DetailsSkeleton /> : null}
      {query.isError ? <Alert tone="error">{errorMessage(query.error)}</Alert> : null}
      {order === undefined ? null : <OrderDetails order={order} />}
    </Dialog>
  );
}

function OrderDetails({ order }: { readonly order: OrderDto }) {
  return (
    <>
      <div className={styles.summary}>
        <OrderStatusBadge status={order.status} />
        <span className={styles.muted}>
          Criado em <time dateTime={order.createdAt.toISOString()}>{formatDateTime(order.createdAt)}</time>
        </span>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Cliente</dt>
          <dd>{order.customerName}</dd>
        </div>
        <div>
          <dt>Telefone</dt>
          <dd>
            <a href={`tel:${order.customerPhone.replace(/\D/g, '')}`}>{order.customerPhone}</a>
          </dd>
        </div>
        <div className={styles.wide}>
          <dt>Endereço de entrega</dt>
          <dd>{order.deliveryAddress}</dd>
        </div>
        <div>
          <dt>Entregador</dt>
          <dd>{order.deliveryPerson?.name ?? 'Não atribuído'}</dd>
        </div>
      </dl>

      <table className={styles.items}>
        <caption className="visually-hidden">Itens do pedido</caption>
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col">Qtd.</th>
            <th scope="col">Preço unit.</th>
            <th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>{item.productName}</td>
              <td>{item.quantity}</td>
              <td>{formatCents(item.unitPriceCents)}</td>
              <td>{formatCents(item.subtotalCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              Total
            </th>
            <td>{formatCents(order.totalCents)}</td>
          </tr>
        </tfoot>
      </table>

      <DeliveryIssuePanel order={order} />

      <StatusHistory order={order} />

      <OrderActions order={order} />
    </>
  );
}

/** Linha do tempo das transições, com o motivo quando houver (entrega devolvida). */
function StatusHistory({ order }: { readonly order: OrderDto }) {
  return (
    <section className={styles.history} aria-label="Histórico do pedido">
      <h3 className={styles.historyTitle}>Histórico</h3>
      <ol className={styles.timeline}>
        {order.statusHistory.map((change) => (
          <li key={`${change.to}-${change.changedAt.toISOString()}`} className={styles.step}>
            <span className={styles.stepStatus}>
              {change.from === null
                ? `Criado como ${ORDER_STATUS_LABELS[change.to].toLowerCase()}`
                : `${ORDER_STATUS_LABELS[change.from]} → ${ORDER_STATUS_LABELS[change.to]}`}
            </span>
            <time className={styles.muted} dateTime={change.changedAt.toISOString()}>
              {formatDateTime(change.changedAt)}
            </time>
            {change.reason === null ? null : <q className={styles.reason}>{change.reason}</q>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function DetailsSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Carregando o pedido" role="status">
      <Skeleton width="6rem" height="1.5rem" />
      <Skeleton height="3.5rem" />
      <Skeleton height="7rem" />
    </div>
  );
}
