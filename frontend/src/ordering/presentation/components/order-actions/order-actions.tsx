import { useId, useState } from 'react';

import { Alert, Button, ConfirmDialog, errorMessage, useCan } from '../../../../shared-kernel/presentation';
import type { OrderDto } from '../../../application';
import type { OrderStatusValue } from '../../../domain';
import { useChangeOrderStatus } from '../../hooks/use-change-order-status';
import { TRANSITION_ACTION_LABELS, TRANSITION_BLOCKER_MESSAGES } from '../../labels/order-labels';
import styles from './order-actions.module.css';

/**
 * Botões contextuais: só as transições válidas a partir do status atual.
 * Cancelar pede confirmação; despachar sem entregador fica desabilitado com
 * o motivo. Perfis sem `orders:write` não veem ações.
 */
export function OrderActions({ order, compact = false }: { readonly order: OrderDto; readonly compact?: boolean }) {
  const canWrite = useCan('orders:write');
  const change = useChangeOrderStatus();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const hintId = useId();

  if (!canWrite || order.transitions.length === 0) return null;

  const apply = (status: OrderStatusValue): void => {
    change.mutate(
      { id: order.id, status },
      {
        onSuccess: () => {
          setConfirmingCancel(false);
        },
      },
    );
  };
  const pendingStatus = change.isPending ? change.variables.status : null;
  const blocker = order.transitions.find((transition) => transition.blockedBy !== null)?.blockedBy ?? null;

  return (
    <div className={styles.actions}>
      <div className={styles.buttons} role="group" aria-label={`Ações do pedido de ${order.customerName}`}>
        {order.transitions.map(({ to, blockedBy }) => (
          <Button
            key={to}
            size={compact ? 'sm' : 'md'}
            variant={to === 'cancelled' ? 'secondary' : 'primary'}
            disabled={blockedBy !== null || change.isPending}
            loading={pendingStatus === to}
            aria-describedby={blockedBy === null ? undefined : hintId}
            title={blockedBy === null ? undefined : TRANSITION_BLOCKER_MESSAGES[blockedBy]}
            onClick={() => (to === 'cancelled' ? setConfirmingCancel(true) : apply(to))}
          >
            {TRANSITION_ACTION_LABELS[to]}
          </Button>
        ))}
      </div>

      {blocker === null ? null : (
        <p id={hintId} className={compact ? 'visually-hidden' : styles.hint}>
          {TRANSITION_BLOCKER_MESSAGES[blocker]}
        </p>
      )}

      {change.error === null || confirmingCancel ? null : <Alert tone="error">{errorMessage(change.error)}</Alert>}

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancelar pedido?"
        description={
          <>
            O pedido de <strong>{order.customerName}</strong> será cancelado. Essa ação não pode ser desfeita.
            {change.error === null ? null : <Alert tone="error">{errorMessage(change.error)}</Alert>}
          </>
        }
        confirmLabel="Cancelar pedido"
        cancelLabel="Manter pedido"
        pending={pendingStatus === 'cancelled'}
        onConfirm={() => apply('cancelled')}
        onCancel={() => {
          setConfirmingCancel(false);
          change.reset();
        }}
      />
    </div>
  );
}
