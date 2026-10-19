import { useId, useState, type FormEvent } from 'react';

import { InputValidationError } from '../../../../shared-kernel/application';
import { Alert, Button, Dialog, TextAreaField, errorMessage } from '../../../../shared-kernel/presentation';
import { returnToAssignmentErrors, type OrderDto } from '../../../application';
import { useReturnOrderToAssignment } from '../../hooks/use-return-order-to-assignment';
import styles from './return-to-assignment-dialog.module.css';

const MAX_REASON_LENGTH = 200;

/**
 * Pede o motivo antes de devolver a entrega: ele fica no histórico do pedido.
 * O texto explica o efeito (o pedido volta para os prontos, sem entregador)
 * para a decisão ser consciente: a comida pode estar com o entregador.
 */
export function ReturnToAssignmentDialog({
  order,
  open,
  onClose,
}: {
  readonly order: OrderDto;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const formId = useId();
  const returnToAssignment = useReturnOrderToAssignment();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const clientError = returnToAssignmentErrors({ reason }).reason;
  const serverError =
    returnToAssignment.error instanceof InputValidationError
      ? returnToAssignment.error.messagesByField()['reason']
      : undefined;
  const formError =
    returnToAssignment.error === null || returnToAssignment.error instanceof InputValidationError
      ? null
      : returnToAssignment.error;

  const close = (): void => {
    setReason('');
    setTouched(false);
    returnToAssignment.reset();
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setTouched(true);
    if (clientError !== undefined) {
      event.currentTarget.querySelector<HTMLElement>('[name="reason"]')?.focus();
      return;
    }
    returnToAssignment.mutate({ id: order.id, reason }, { onSuccess: close });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Devolver entrega para a atribuição?"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={returnToAssignment.isPending}>
            Voltar
          </Button>
          <Button type="submit" form={formId} loading={returnToAssignment.isPending}>
            Devolver para a atribuição
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <p>
          O pedido de <strong>{order.customerName}</strong> volta para os prontos, sem entregador
          {order.deliveryPerson === null ? '' : ` (${order.deliveryPerson.name} fica livre)`}. Confirme com o
          entregador antes: a comida pode estar com ele.
        </p>
        {formError === null ? null : <Alert tone="error">{errorMessage(formError)}</Alert>}
        <TextAreaField
          label="Motivo"
          name="reason"
          rows={3}
          maxLengthHint={MAX_REASON_LENGTH}
          placeholder="Ex.: entregador sem contato há 30 minutos"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? (clientError ?? serverError) : undefined}
        />
      </form>
    </Dialog>
  );
}
