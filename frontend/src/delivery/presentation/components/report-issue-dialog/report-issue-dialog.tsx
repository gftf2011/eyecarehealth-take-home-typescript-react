import { useId, useState, type FormEvent } from 'react';

import { InputValidationError } from '../../../../shared-kernel/application';
import { Alert, Button, Dialog, SelectField, TextAreaField, errorMessage } from '../../../../shared-kernel/presentation';
import { courierIssueErrors } from '../../../application';
import { COURIER_ISSUE_REASONS, type CourierDelivery } from '../../../domain';
import { useReportMyDeliveryIssue } from '../../hooks/use-report-my-delivery-issue';
import { COURIER_ISSUE_REASON_LABELS } from '../../labels/delivery-labels';
import styles from './report-issue-dialog.module.css';

const REASON_OPTIONS = [
  { value: '', label: 'Selecione…' },
  ...COURIER_ISSUE_REASONS.map((reason) => ({ value: reason, label: COURIER_ISSUE_REASON_LABELS[reason] })),
];

/**
 * "Não consegui entregar": o entregador escolhe o motivo (e descreve, se for
 * outro). O pedido continua com ele; o gestor decide o que fazer.
 */
export function ReportIssueDialog({
  delivery,
  open,
  onClose,
}: {
  readonly delivery: CourierDelivery;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const formId = useId();
  const report = useReportMyDeliveryIssue();
  const [values, setValues] = useState({ reason: '', note: '' });
  const [submitted, setSubmitted] = useState(false);

  const clientErrors = courierIssueErrors(values);
  const serverErrors = report.error instanceof InputValidationError ? report.error.messagesByField() : {};
  const formError = report.error === null || report.error instanceof InputValidationError ? null : report.error;
  const fieldError = (field: 'reason' | 'note'): string | undefined =>
    submitted ? (clientErrors[field] ?? serverErrors[field]) : undefined;

  const close = (): void => {
    setValues({ reason: '', note: '' });
    setSubmitted(false);
    report.reset();
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmitted(true);
    const firstInvalid = (['reason', 'note'] as const).find((field) => clientErrors[field] !== undefined);
    if (firstInvalid !== undefined) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    report.mutate({ orderId: delivery.orderId, ...values }, { onSuccess: close });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Não conseguiu entregar?"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={report.isPending}>
            Voltar
          </Button>
          <Button type="submit" form={formId} loading={report.isPending}>
            Relatar problema
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <p>
          O pedido de <strong>{delivery.customerName}</strong> continua com você. O gestor vai decidir: tentar de
          novo, devolver ao restaurante ou cancelar.
        </p>
        {formError === null ? null : <Alert tone="error">{errorMessage(formError)}</Alert>}
        <SelectField
          label="Motivo"
          name="reason"
          options={REASON_OPTIONS}
          value={values.reason}
          onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))}
          error={fieldError('reason')}
        />
        <TextAreaField
          label={values.reason === 'other' ? 'Observação' : 'Observação (opcional)'}
          name="note"
          rows={3}
          maxLengthHint={150}
          placeholder="Ex.: portão fechado, ninguém atende o telefone"
          value={values.note}
          onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
          error={fieldError('note')}
        />
      </form>
    </Dialog>
  );
}
