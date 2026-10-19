import {
  Alert,
  Button,
  EmptyState,
  Pagination,
  Spinner,
  errorMessage,
} from '../../../../shared-kernel/presentation';
import { OrderDetailsDialog } from '../../components/order-details-dialog/order-details-dialog';
import { OrderFilters } from '../../components/order-filters/order-filters';
import { OrderList } from '../../components/order-list/order-list';
import { OrderListSkeleton } from '../../components/order-list-skeleton/order-list-skeleton';
import { useOrderFilters } from '../../hooks/use-order-filters';
import { useOrderLiveUpdates } from '../../hooks/use-order-live-updates';
import { useOrders } from '../../hooks/use-orders';
import styles from './orders-page.module.css';

/** Painel de pedidos: filtros na URL, lista paginada, ações de status e detalhe em modal. */
export function OrdersPage() {
  const { filters, input, openOrderId, applyFilters, goToCursor, openOrder, closeOrder } = useOrderFilters();
  const orders = useOrders(input);
  useOrderLiveUpdates();
  const page = orders.data;
  const filtered = Object.values(filters).some((value) => value !== '');
  // Um link de página antigo (cursor) pode não valer mais: sempre há o caminho de volta ao início.
  const backToStart =
    input.cursor === '' ? undefined : (
      <Button variant="secondary" size="sm" onClick={() => goToCursor(null)}>
        Primeira página
      </Button>
    );

  return (
    <section className={styles.page} aria-labelledby="orders-title">
      <header className={styles.header}>
        <div>
          <h1 id="orders-title" className={styles.title}>
            Pedidos
          </h1>
          <p className={styles.subtitle}>Acompanhe e avance os pedidos pela cozinha até a entrega.</p>
        </div>
        {orders.isFetching && page !== undefined ? <Spinner size="sm" label="Atualizando pedidos" /> : null}
      </header>

      <OrderFilters value={filters} onApply={applyFilters} />

      {orders.isError ? (
        <Alert tone="error" title="Não foi possível carregar os pedidos">
          <p>{errorMessage(orders.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => void orders.refetch()}>
            Tentar novamente
          </Button>
          {backToStart}
        </Alert>
      ) : null}

      {orders.isPending ? <OrderListSkeleton /> : null}

      {page !== undefined && page.data.length === 0 ? (
        <EmptyState
          title={filtered ? 'Nenhum pedido com esses filtros' : 'Nenhum pedido ainda'}
          description={
            filtered
              ? 'Ajuste o status ou o período para ver outros pedidos.'
              : 'Os pedidos aparecem aqui assim que forem criados.'
          }
          action={backToStart}
        />
      ) : null}

      {page !== undefined && page.data.length > 0 ? (
        <div className={styles.results} aria-busy={orders.isFetching}>
          <OrderList orders={page.data} onOpen={openOrder} />
          <Pagination
            pagination={page.pagination}
            count={page.data.length}
            onCursorChange={goToCursor}
            itemLabel="pedidos"
          />
        </div>
      ) : null}

      <OrderDetailsDialog orderId={openOrderId} onClose={closeOrder} />
    </section>
  );
}
