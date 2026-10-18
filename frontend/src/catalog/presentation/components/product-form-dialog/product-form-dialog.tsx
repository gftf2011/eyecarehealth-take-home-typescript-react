import { useId } from 'react';

import { Button, Dialog } from '../../../../shared-kernel/presentation';
import { EMPTY_PRODUCT_FORM, productFormInputFrom, type ProductDto } from '../../../application';
import { useSaveProduct } from '../../hooks/use-save-product';
import { ProductForm } from '../product-form/product-form';

export type ProductFormDialogProps = {
  /** `'new'` cria; um produto edita; `null` mantém fechado. */
  readonly product: ProductDto | 'new' | null;
  readonly onClose: () => void;
  readonly onSaved?: (product: ProductDto) => void;
};

/** Criar ou editar produto em modal; fecha ao salvar. */
export function ProductFormDialog({ product, onClose, onSaved }: ProductFormDialogProps) {
  const formId = useId();
  const editing = product !== null && product !== 'new' ? product : null;
  const save = useSaveProduct(editing?.id ?? null);

  const close = (): void => {
    save.reset();
    onClose();
  };

  return (
    <Dialog
      open={product !== null}
      onClose={close}
      title={editing === null ? 'Novo produto' : `Editar ${editing.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {editing === null ? 'Criar produto' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      {product === null ? null : (
        <ProductForm
          key={editing?.id ?? 'new'}
          id={formId}
          initialValue={editing === null ? EMPTY_PRODUCT_FORM : productFormInputFrom(editing)}
          error={save.error}
          onSubmit={(input) =>
            save.mutate(input, {
              onSuccess: (saved) => {
                onSaved?.(saved);
                close();
              },
            })
          }
        />
      )}
    </Dialog>
  );
}
