import { Alert, Button, errorMessage } from '../../../../shared-kernel/presentation';
import type { AssignmentPlan } from '../../../domain';
import { UNASSIGNED_REASON_LABELS, formatKm } from '../../labels/delivery-labels';
import { AssignmentCard } from '../assignment-card/assignment-card';
import styles from './assignment-plan-panel.module.css';

export type AssignmentPlanPanelProps = {
  readonly plan: AssignmentPlan;
  readonly accepting: ReadonlySet<string>;
  readonly acceptError: unknown;
  readonly onAccept: (orderId: string) => void;
  readonly onAcceptAll: () => void;
  readonly onReject: (orderId: string) => void;
  readonly onDiscard: () => void;
};

/** Resultado da otimização: resumo, pares para aceitar/rejeitar, pedidos sem entregador e avisos. */
export function AssignmentPlanPanel({
  plan,
  accepting,
  acceptError,
  onAccept,
  onAcceptAll,
  onReject,
  onDiscard,
}: AssignmentPlanPanelProps) {
  const busy = accepting.size > 0;

  return (
    <section className={styles.panel} aria-labelledby="plan-title">
      <header className={styles.header}>
        <div>
          <h2 id="plan-title" className={styles.title}>
            Sugestão de atribuição
          </h2>
          <p className={styles.subtitle}>Menor distância total entre entregadores e pedidos.</p>
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onDiscard} disabled={busy}>
            Descartar
          </Button>
          {plan.pending.length > 0 ? (
            <Button onClick={onAcceptAll} loading={busy} disabled={busy}>
              Aceitar todas ({plan.pending.length})
            </Button>
          ) : null}
        </div>
      </header>

      <dl className={styles.metrics}>
        <div>
          <dt>Atribuições</dt>
          <dd>{plan.assignments.length}</dd>
        </div>
        <div>
          <dt>Distância total</dt>
          <dd>{formatKm(plan.totalDistanceKm)}</dd>
        </div>
        <div>
          <dt>Despachado</dt>
          <dd>{formatKm(plan.acceptedDistanceKm)}</dd>
        </div>
        <div>
          <dt>Algoritmo</dt>
          <dd>
            {plan.algorithm === 'hungarian' ? 'Húngaro' : plan.algorithm} · {plan.executionTimeMs.toLocaleString('pt-BR')} ms
          </dd>
        </div>
      </dl>

      {acceptError === null ? null : (
        <Alert tone="error" title="Não foi possível aceitar a atribuição">
          {errorMessage(acceptError)}
        </Alert>
      )}

      {plan.isEmpty ? (
        <p className={styles.empty}>Nenhum pedido pronto para atribuir.</p>
      ) : (
        <ul className={styles.list} aria-label="Atribuições sugeridas">
          {plan.assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.orderId}
              assignment={assignment}
              accepting={accepting.has(assignment.orderId)}
              disabled={busy && !accepting.has(assignment.orderId)}
              onAccept={() => onAccept(assignment.orderId)}
              onReject={() => onReject(assignment.orderId)}
            />
          ))}
        </ul>
      )}

      {plan.unassigned.length === 0 ? null : (
        <Alert tone="warning" title={`${plan.unassigned.length} pedido(s) sem entregador`}>
          <ul className={styles.plain}>
            {plan.unassigned.map((order) => (
              <li key={order.orderId}>
                {order.orderAddress} — {UNASSIGNED_REASON_LABELS[order.reason]}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {plan.unlocatedDeliveryPersons.length === 0 ? null : (
        <Alert tone="info" title="Entregadores sem localização">
          {plan.unlocatedDeliveryPersons.map((person) => person.name).join(', ')} ficaram fora do cálculo
          porque não informaram a posição.
        </Alert>
      )}
    </section>
  );
}
