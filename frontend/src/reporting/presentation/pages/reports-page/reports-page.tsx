import { formatDate } from '../../../../shared-kernel/presentation';
import { DeliveryTimeTable } from '../../components/delivery-time-table/delivery-time-table';
import { OrdersByStatusChart } from '../../components/orders-by-status-chart/orders-by-status-chart';
import { ReportCard } from '../../components/report-card/report-card';
import { ReportPeriodFilter } from '../../components/report-period-filter/report-period-filter';
import { RevenueChart } from '../../components/revenue-chart/revenue-chart';
import { SummaryMetrics } from '../../components/summary-metrics/summary-metrics';
import { TopProductsChart } from '../../components/top-products-chart/top-products-chart';
import { useReport } from '../../hooks/use-report';
import { useReportLiveUpdates } from '../../hooks/use-report-live-updates';
import { useReportPeriod } from '../../hooks/use-report-period';
import styles from './reports-page.module.css';

const asDate = (iso: string | undefined): string => (iso === undefined ? '' : formatDate(new Date(`${iso}T12:00:00Z`)));

/** Relatórios: as quatro métricas do backend para o período, com resumo e gráficos. */
export function ReportsPage() {
  useReportLiveUpdates();
  const { period, valid, applyPeriod } = useReportPeriod();
  const revenue = useReport('revenue', period, valid);
  const ordersByStatus = useReport('ordersByStatus', period, valid);
  const topProducts = useReport('topProducts', period, valid);
  const deliveryTime = useReport('deliveryTime', period, valid);

  return (
    <section className={styles.page} aria-labelledby="reports-title">
      <header className={styles.header}>
        <h1 id="reports-title" className={styles.title}>
          Relatórios
        </h1>
        <p className={styles.subtitle}>
          {valid
            ? `De ${asDate(period.startDate)} a ${asDate(period.endDate)} · dias de São Paulo`
            : 'Ajuste o período para ver os relatórios.'}
        </p>
      </header>

      <ReportPeriodFilter value={period} onApply={applyPeriod} />

      <SummaryMetrics revenue={revenue.data} deliveryTime={deliveryTime.data} />

      <div className={styles.grid}>
        <ReportCard
          title="Receita por dia"
          description="Pedidos entregues, pela data da entrega."
          query={revenue}
          isEmpty={(report) => report.totalOrders === 0}
          emptyMessage="Nenhum pedido entregue no período."
          wide
        >
          {(report) => <RevenueChart report={report} />}
        </ReportCard>

        <ReportCard
          title="Produtos mais vendidos"
          description="Top 10 por quantidade, só pedidos entregues."
          query={topProducts}
          isEmpty={(report) => report.products.length === 0}
          emptyMessage="Nenhum produto vendido no período."
        >
          {(report) => <TopProductsChart report={report} />}
        </ReportCard>

        <ReportCard
          title="Pedidos por status"
          description="Pedidos criados no período, pelo status atual."
          query={ordersByStatus}
          isEmpty={(report) => report.total === 0}
          emptyMessage="Nenhum pedido criado no período."
        >
          {(report) => <OrdersByStatusChart report={report} />}
        </ReportCard>

        <ReportCard
          title="Tempo médio de entrega"
          description="Da criação do pedido à entrega, por tipo de veículo."
          query={deliveryTime}
          isEmpty={(report) => report.totalDelivered === 0}
          emptyMessage="Nenhuma entrega concluída no período."
          wide
        >
          {(report) => <DeliveryTimeTable report={report} />}
        </ReportCard>
      </div>
    </section>
  );
}
