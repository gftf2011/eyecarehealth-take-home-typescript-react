import { ConflictError } from '../../../../shared-kernel/domain';
import { Alert, ConfirmDialog, errorMessage } from '../../../../shared-kernel/presentation';
import type { DeliveryPersonDto } from '../../../application';
import { useRemoveDeliveryPerson } from '../../hooks/use-remove-delivery-person';

/**
 * Confirmação antes de excluir. Com entrega em andamento, a API recusa
 * (`409 DELIVERY_PERSON_IN_USE`) e a mensagem aparece aqui mesmo, sugerindo
 * desativar em vez de excluir.
 */
export function RemoveDeliveryPersonDialog({
  person,
  onClose,
}: {
  readonly person: DeliveryPersonDto | null;
  readonly onClose: () => void;
}) {
  const remove = useRemoveDeliveryPerson();

  const close = (): void => {
    remove.reset();
    onClose();
  };

  return (
    <ConfirmDialog
      open={person !== null}
      title="Excluir entregador?"
      description={
        <>
          <p>
            <strong>{person?.name}</strong> sai da frota. Pedidos antigos continuam mostrando o entregador.
          </p>
          {remove.error === null ? null : (
            <Alert tone="error">
              {errorMessage(remove.error)}
              {remove.error instanceof ConflictError
                ? '. Espere a entrega terminar ou desative-o para não receber novas atribuições.'
                : null}
            </Alert>
          )}
        </>
      }
      confirmLabel="Excluir entregador"
      cancelLabel="Voltar"
      pending={remove.isPending}
      onCancel={close}
      onConfirm={() => {
        if (person !== null) remove.mutate({ id: person.id }, { onSuccess: close });
      }}
    />
  );
}
