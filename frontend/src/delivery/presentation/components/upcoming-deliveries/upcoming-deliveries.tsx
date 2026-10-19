import type { CourierDelivery } from '../../../domain';
import { COURIER_STATUS_LABELS } from '../../labels/delivery-labels';
import styles from './upcoming-deliveries.module.css';

/** Pedidos já atribuídos ao entregador que ainda não saíram, mais antigos primeiro. */
export function UpcomingDeliveries({ deliveries }: { readonly deliveries: readonly CourierDelivery[] }) {
  if (deliveries.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="upcoming-title">
      <h2 id="upcoming-title" className={styles.title}>
        Próximas entregas
      </h2>
      <ul className={styles.list} aria-label="Próximas entregas">
        {deliveries.map((delivery) => (
          <li key={delivery.orderId} className={styles.item}>
            <div className={styles.header}>
              <span className={styles.customer}>{delivery.customerName}</span>
              <span className={styles.muted}>{COURIER_STATUS_LABELS[delivery.status]}</span>
            </div>
            <span className={styles.muted}>{delivery.deliveryAddress}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
