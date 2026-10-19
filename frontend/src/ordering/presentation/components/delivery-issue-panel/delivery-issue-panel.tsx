import { useState } from 'react';

import { Alert, Button, ConfirmDialog, errorMessage, formatDateTime, useCan } from '../../../../shared-kernel/presentation';
import type { OrderDto } from '../../../application';
import { useResolveDeliveryIssue } from '../../hooks/use-resolve-delivery-issue';
import { DELIVERY_ISSUE_REASON_LABELS, DELIVERY_ISSUE_RESOLUTION_LABELS } from '../../labels/order-labels';
import styles from './delivery-issue-panel.module.css';

/**
 * O problema que o entregador relatou e a decisão do gestor: tentar de novo
 * ou cancelar (devolver para a atribuição fica nas ações do pedido). Mostra
 * também as tentativas anteriores, já resolvidas.
 */
export function DeliveryIssuePanel({ order }: { readonly order: OrderDto }) {
  const canWrite = useCan('orders:write');
  const resolve = useResolveDeliveryIssue();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const open = order.openDeliveryIssue;
  const decisions = order.deliveryIssueDecisions;
  const past = order.deliveryIssues.filter((issue) => issue.resolvedAt !== null);
  if (open === null && past.length === 0) return null;

  const pending = resolve.isPending ? resolve.variables.decision : null;

  return (
    <section className={styles.panel} aria-label="Problemas na entrega">
      {open === null ? null : (
        <Alert tone="warning" title={`Problema na entrega: ${DELIVERY_ISSUE_REASON_LABELS[open.reason]}`}>
          {open.note === null ? null : <p>{open.note}</p>}
          <p className={styles.muted}>
            Relatado pelo entregador em {formatDateTime(open.reportedAt)}. O pedido segue com ele até você decidir.
          </p>
        </Alert>
      )}

      {open !== null && canWrite ? (
        <>
          <div className={styles.buttons} role="group" aria-label="Decisão sobre a entrega">
            {decisions.includes('retry') ? (
              <Button
                loading={pending === 'retry'}
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: order.id, decision: 'retry' })}
              >
                Tentar de novo
              </Button>
            ) : null}
            {decisions.includes('cancel') ? (
              <Button variant="secondary" disabled={resolve.isPending} onClick={() => setConfirmingCancel(true)}>
                Cancelar entrega
              </Button>
            ) : null}
          </div>
          {decisions.includes('retry') ? null : (
            <p className={styles.muted}>
              {open.reason === 'refused'
                ? 'O cliente recusou: a única saída é cancelar.'
                : 'Limite de novas tentativas atingido: devolva para a atribuição ou cancele.'}
            </p>
          )}
        </>
      ) : null}

      {resolve.error === null || confirmingCancel ? null : <Alert tone="error">{errorMessage(resolve.error)}</Alert>}

      {past.length === 0 ? null : (
        <ol className={styles.attempts} aria-label="Tentativas anteriores">
          {past.map((issue) => (
            <li key={issue.id}>
              {DELIVERY_ISSUE_REASON_LABELS[issue.reason]}
              {issue.note === null ? '' : ` (${issue.note})`} →{' '}
              {issue.resolution === null ? '' : DELIVERY_ISSUE_RESOLUTION_LABELS[issue.resolution]}
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancelar a entrega?"
        description={
          <>
            O pedido de <strong>{order.customerName}</strong> será cancelado com o motivo relatado pelo entregador, que
            fica livre. Combine com ele a volta da comida ao restaurante.
            {resolve.error === null ? null : <Alert tone="error">{errorMessage(resolve.error)}</Alert>}
          </>
        }
        confirmLabel="Cancelar pedido"
        cancelLabel="Voltar"
        pending={pending === 'cancel'}
        onCancel={() => {
          setConfirmingCancel(false);
          resolve.reset();
        }}
        onConfirm={() =>
          resolve.mutate({ id: order.id, decision: 'cancel' }, { onSuccess: () => setConfirmingCancel(false) })
        }
      />
    </section>
  );
}
