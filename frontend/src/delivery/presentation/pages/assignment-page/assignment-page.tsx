import { Alert, Button, Skeleton, errorMessage } from '../../../../shared-kernel/presentation';
import { AssignmentPlanPanel } from '../../components/assignment-plan-panel/assignment-plan-panel';
import { AvailableCouriersPanel } from '../../components/available-couriers-panel/available-couriers-panel';
import { ReadyOrdersPanel } from '../../components/ready-orders-panel/ready-orders-panel';
import { useAssignmentPlan } from '../../hooks/use-assignment-plan';
import { useDispatchBoard } from '../../hooks/use-dispatch-board';
import { useDispatchBoardLiveUpdates } from '../../hooks/use-dispatch-board-live-updates';
import styles from './assignment-page.module.css';

/**
 * Atribuição de entregadores: quadro com pedidos prontos e entregadores
 * livres, sugestão otimizada pelo backend e aceite/rejeição de cada par.
 */
export function AssignmentPage() {
  const board = useDispatchBoard();
  useDispatchBoardLiveUpdates();
  const assignment = useAssignmentPlan();
  const data = board.data;
  const nothingToAssign = data !== undefined && data.readyOrders.length === 0;

  return (
    <section className={styles.page} aria-labelledby="assignment-title">
      <header className={styles.header}>
        <div>
          <h1 id="assignment-title" className={styles.title}>
            Atribuição de entregadores
          </h1>
          <p className={styles.subtitle}>
            O otimizador minimiza a distância total (algoritmo Húngaro com distância de Haversine).
          </p>
        </div>
        <Button onClick={assignment.suggest} loading={assignment.suggesting} disabled={nothingToAssign}>
          Sugerir atribuição otimizada
        </Button>
      </header>

      {assignment.suggestError === null ? null : (
        <Alert tone="error" title="Não foi possível calcular a sugestão">
          {errorMessage(assignment.suggestError)}
        </Alert>
      )}

      {assignment.plan === null ? null : (
        <AssignmentPlanPanel
          plan={assignment.plan}
          accepting={assignment.accepting}
          acceptError={assignment.acceptError}
          onAccept={(orderId) => void assignment.accept(orderId)}
          onAcceptAll={() => void assignment.acceptAll()}
          onReject={assignment.reject}
          onDiscard={assignment.discard}
        />
      )}

      {board.isError ? (
        <Alert tone="error" title="Não foi possível carregar pedidos e entregadores">
          <p>{errorMessage(board.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => void board.refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      ) : null}

      {board.isPending ? (
        <div className={styles.board} aria-label="Carregando pedidos e entregadores" role="status">
          <Skeleton height="16rem" />
          <Skeleton height="16rem" />
        </div>
      ) : null}

      {data === undefined ? null : (
        <div className={styles.board}>
          <ReadyOrdersPanel orders={data.readyOrders} hasMore={data.hasMoreReadyOrders} />
          <AvailableCouriersPanel couriers={data.availableCouriers} />
        </div>
      )}
    </section>
  );
}
