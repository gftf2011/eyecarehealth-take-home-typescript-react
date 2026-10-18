import { Button, cx } from '../../../../shared-kernel/presentation';
import type { SuggestedAssignment } from '../../../domain';
import { formatKm } from '../../labels/delivery-labels';
import styles from './assignment-card.module.css';

const STATUS_LABELS = {
  pending: 'Sugerido',
  accepted: 'Despachado',
  rejected: 'Rejeitado',
  failed: 'Não aplicado',
} as const;

export type AssignmentCardProps = {
  readonly assignment: SuggestedAssignment;
  readonly accepting: boolean;
  readonly disabled: boolean;
  readonly onAccept: () => void;
  readonly onReject: () => void;
};

/** Um par sugerido: pedido → entregador, distância e a decisão do gestor. */
export function AssignmentCard({ assignment, accepting, disabled, onAccept, onReject }: AssignmentCardProps) {
  const { decision } = assignment;
  return (
    <li className={cx(styles.card, styles[decision.status])} aria-label={`Pedido em ${assignment.orderAddress}`}>
      <div className={styles.route}>
        <div className={styles.end}>
          <span className={styles.label}>Pedido</span>
          <span className={styles.value}>{assignment.orderAddress}</span>
        </div>
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
        <div className={styles.end}>
          <span className={styles.label}>Entregador</span>
          <span className={styles.value}>{assignment.deliveryPersonName}</span>
        </div>
        <span className={styles.distance}>{formatKm(assignment.distanceKm)}</span>
      </div>

      <div className={styles.footer}>
        <span className={styles.status}>{STATUS_LABELS[decision.status]}</span>
        {decision.status === 'failed' ? <span className={styles.reason}>{decision.reason}</span> : null}
        {decision.status === 'pending' ? (
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={onReject} disabled={disabled || accepting}>
              Rejeitar
            </Button>
            <Button size="sm" onClick={onAccept} loading={accepting} disabled={disabled}>
              Aceitar
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
