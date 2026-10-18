import { cx } from '../../../../shared-kernel/presentation';
import type { OrderStatusValue } from '../../../domain';
import { ORDER_STATUS_LABELS } from '../../labels/order-labels';
import styles from './order-status-badge.module.css';

/** Status com cor e ícone próprios (o ícone garante leitura sem depender só da cor). */
export function OrderStatusBadge({ status }: { readonly status: OrderStatusValue }) {
  return (
    <span className={cx(styles.badge, styles[status])}>
      <span className={styles.icon} aria-hidden="true" />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
