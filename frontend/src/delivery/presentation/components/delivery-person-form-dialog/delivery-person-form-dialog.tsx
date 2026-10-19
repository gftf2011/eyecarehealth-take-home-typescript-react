import { useId } from 'react';

import { Button, Dialog } from '../../../../shared-kernel/presentation';
import {
  EMPTY_DELIVERY_PERSON_FORM,
  deliveryPersonFormInputFrom,
  type DeliveryPersonDto,
} from '../../../application';
import { useSaveDeliveryPerson } from '../../hooks/use-save-delivery-person';
import { DeliveryPersonForm } from '../delivery-person-form/delivery-person-form';

export type DeliveryPersonFormDialogProps = {
  /** `'new'` cadastra; um entregador edita; `null` mantém fechado. */
  readonly person: DeliveryPersonDto | 'new' | null;
  readonly onClose: () => void;
};

/** Cadastrar ou editar entregador em modal; fecha ao salvar. */
export function DeliveryPersonFormDialog({ person, onClose }: DeliveryPersonFormDialogProps) {
  const formId = useId();
  const editing = person !== null && person !== 'new' ? person : null;
  const save = useSaveDeliveryPerson(editing?.id ?? null);

  const close = (): void => {
    save.reset();
    onClose();
  };

  return (
    <Dialog
      open={person !== null}
      onClose={close}
      title={editing === null ? 'Novo entregador' : `Editar ${editing.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {editing === null ? 'Cadastrar entregador' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      {person === null ? null : (
        <DeliveryPersonForm
          key={editing?.id ?? 'new'}
          id={formId}
          initialValue={editing === null ? EMPTY_DELIVERY_PERSON_FORM : deliveryPersonFormInputFrom(editing)}
          error={save.error}
          onSubmit={(input) => save.mutate(input, { onSuccess: close })}
        />
      )}
    </Dialog>
  );
}
