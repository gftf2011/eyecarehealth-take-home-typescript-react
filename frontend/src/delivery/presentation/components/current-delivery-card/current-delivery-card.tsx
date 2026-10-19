import { useState } from 'react';

import { Alert, Button, ConfirmDialog, errorMessage, formatCents } from '../../../../shared-kernel/presentation';
import type { CourierDelivery } from '../../../domain';
import { useConfirmMyDelivery } from '../../hooks/use-confirm-my-delivery';
import { COURIER_ISSUE_REASON_LABELS, mapsUrl } from '../../labels/delivery-labels';
import { ReportIssueDialog } from '../report-issue-dialog/report-issue-dialog';
import styles from './current-delivery-card.module.css';

/**
 * A entrega em andamento, pensada para o celular: cliente, telefone para
 * ligar, endereço para abrir no mapa, itens e um botão grande para confirmar.
 */
export function CurrentDeliveryCard({ delivery }: { readonly delivery: CourierDelivery }) {
  const confirm = useConfirmMyDelivery();
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const issue = delivery.openIssue;

  return (
    <section className={styles.card} aria-labelledby="current-delivery-title">
      <div>
        <p className={styles.eyebrow}>Entrega em andamento</p>
        <h2 id="current-delivery-title" className={styles.customer}>
          {delivery.customerName}
        </h2>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Endereço</dt>
          <dd>
            <span>{delivery.deliveryAddress}</span>
            <a href={mapsUrl(delivery.latitude, delivery.longitude)} target="_blank" rel="noreferrer">
              Abrir no mapa
            </a>
          </dd>
        </div>
        <div>
          <dt>Telefone</dt>
          <dd>
            <a href={`tel:${delivery.customerPhone.replace(/\D/g, '')}`}>Ligar para {delivery.customerPhone}</a>
          </dd>
        </div>
        <div>
          <dt>Itens</dt>
          <dd>
            <ul className={styles.items}>
              {delivery.items.map((item) => (
                <li key={item.productName}>
                  {item.quantity}× {item.productName}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd className={styles.total}>{formatCents(delivery.totalCents)}</dd>
        </div>
      </dl>

      {issue === null ? null : (
        <Alert tone="warning" title={`Problema relatado: ${COURIER_ISSUE_REASON_LABELS[issue.reason]}`}>
          {issue.note === null ? null : <p>{issue.note}</p>}
          <p>Aguardando a decisão do gestor. A entrega só continua depois dela: se o cliente aparecer, avise o gestor.</p>
        </Alert>
      )}

      {confirm.error === null || confirming ? null : <Alert tone="error">{errorMessage(confirm.error)}</Alert>}

      {issue === null ? (
        <div className={styles.confirm}>
          <Button fullWidth onClick={() => setConfirming(true)} disabled={confirm.isPending}>
            Confirmar entrega
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setReporting(true)}>
            Não consegui entregar
          </Button>
        </div>
      ) : null}

      <ReportIssueDialog delivery={delivery} open={reporting} onClose={() => setReporting(false)} />

      <ConfirmDialog
        open={confirming}
        title="Confirmar entrega?"
        tone="primary"
        description={
          <>
            Confirme só depois de entregar o pedido a <strong>{delivery.customerName}</strong>.
            {confirm.error === null ? null : <Alert tone="error">{errorMessage(confirm.error)}</Alert>}
          </>
        }
        confirmLabel="Entreguei"
        cancelLabel="Ainda não"
        pending={confirm.isPending}
        onCancel={() => {
          setConfirming(false);
          confirm.reset();
        }}
        onConfirm={() => confirm.mutate({ orderId: delivery.orderId }, { onSuccess: () => setConfirming(false) })}
      />
    </section>
  );
}
