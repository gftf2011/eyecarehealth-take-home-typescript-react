import { Skeleton, formatCents } from '../../../../shared-kernel/presentation';
import type { DeliveryTimeReport, RevenueReport } from '../../../domain';
import { formatMinutes } from '../../labels/report-labels';
import styles from './summary-metrics.module.css';

type Metric = { readonly label: string; readonly value: string | null; readonly hint?: string };

/** Números principais do período: receita, entregas, ticket médio e tempo de entrega. */
export function SummaryMetrics({
  revenue,
  deliveryTime,
}: {
  readonly revenue: RevenueReport | undefined;
  readonly deliveryTime: DeliveryTimeReport | undefined;
}) {
  const metrics: readonly Metric[] = [
    { label: 'Receita', value: revenue === undefined ? null : formatCents(revenue.totalCents) },
    { label: 'Pedidos entregues', value: revenue === undefined ? null : String(revenue.totalOrders) },
    { label: 'Ticket médio', value: revenue === undefined ? null : formatCents(revenue.averageOrderCents) },
    {
      label: 'Tempo médio de entrega',
      value:
        deliveryTime === undefined
          ? null
          : deliveryTime.averageMinutes === null
            ? '—'
            : formatMinutes(deliveryTime.averageMinutes),
      hint: 'Da criação do pedido à entrega',
    },
  ];

  return (
    <dl className={styles.metrics}>
      {metrics.map((metric) => (
        <div key={metric.label} className={styles.metric}>
          <dt className={styles.label}>{metric.label}</dt>
          <dd className={styles.value}>{metric.value ?? <Skeleton width="6rem" height="1.75rem" />}</dd>
          {metric.hint === undefined ? null : <dd className={styles.hint}>{metric.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
