import { Alert, Button, EmptyState, Skeleton, Spinner, errorMessage } from '../../../../shared-kernel/presentation';
import { CurrentDeliveryCard } from '../../components/current-delivery-card/current-delivery-card';
import { LocationCard } from '../../components/location-card/location-card';
import { UpcomingDeliveries } from '../../components/upcoming-deliveries/upcoming-deliveries';
import { useMyDeliveries } from '../../hooks/use-my-deliveries';
import { useMyDeliveriesLiveUpdates } from '../../hooks/use-my-deliveries-live-updates';
import styles from './my-deliveries-page.module.css';

/**
 * A tela do entregador (perfil `courier`): só as entregas dele. Uma por vez,
 * com o que ele precisa na rua; atualiza sozinha quando o gestor despacha,
 * troca ou devolve um pedido dele.
 */
export function MyDeliveriesPage() {
  useMyDeliveriesLiveUpdates();
  const deliveries = useMyDeliveries();
  const data = deliveries.data;

  return (
    <section className={styles.page} aria-labelledby="my-deliveries-title">
      <header className={styles.header}>
        <div>
          <h1 id="my-deliveries-title" className={styles.title}>
            Minhas entregas
          </h1>
          {data === undefined ? null : <p className={styles.subtitle}>Olá, {data.courier.name}.</p>}
        </div>
        <div className={styles.headerActions}>
          {deliveries.isFetching && data !== undefined ? <Spinner size="sm" label="Atualizando entregas" /> : null}
        </div>
      </header>

      <div className={styles.content}>
        {deliveries.isError ? (
          <Alert tone="error" title="Não foi possível carregar as suas entregas">
            <p>{errorMessage(deliveries.error)}</p>
            <Button variant="secondary" size="sm" onClick={() => void deliveries.refetch()}>
              Tentar novamente
            </Button>
          </Alert>
        ) : null}

        {deliveries.isPending ? <Skeleton height="16rem" /> : null}

        {data === undefined ? null : (
          <>
            {data.inProgress === null ? (
              <EmptyState
                title="Nenhuma entrega em andamento"
                description={
                  data.upcoming.length === 0
                    ? 'Quando o gestor despachar um pedido para você, ele aparece aqui.'
                    : 'Retire o próximo pedido quando ele ficar pronto.'
                }
              />
            ) : (
              <CurrentDeliveryCard delivery={data.inProgress} />
            )}
            <UpcomingDeliveries deliveries={data.upcoming} />
            <LocationCard />
          </>
        )}
      </div>
    </section>
  );
}
