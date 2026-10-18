import { ConflictError } from '../../../../shared-kernel/domain';
import { Alert, ConfirmDialog, errorMessage } from '../../../../shared-kernel/presentation';
import type { ProductDto } from '../../../application';
import { useRemoveProduct } from '../../hooks/use-remove-product';

/**
 * Confirmação antes de excluir. Se o produto estiver em pedido aberto, a API
 * recusa (`409 PRODUCT_IN_USE`) e a mensagem aparece aqui mesmo, sugerindo
 * desativar em vez de excluir.
 */
export function RemoveProductDialog({
  product,
  onClose,
}: {
  readonly product: ProductDto | null;
  readonly onClose: () => void;
}) {
  const remove = useRemoveProduct();

  const close = (): void => {
    remove.reset();
    onClose();
  };

  return (
    <ConfirmDialog
      open={product !== null}
      title="Excluir produto?"
      description={
        <>
          <p>
            <strong>{product?.name}</strong> sai do cardápio. Pedidos antigos continuam mostrando o produto.
          </p>
          {remove.error === null ? null : (
            <Alert tone="error">
              {errorMessage(remove.error)}
              {remove.error instanceof ConflictError
                ? ' Você pode marcá-lo como indisponível em vez de excluir.'
                : null}
            </Alert>
          )}
        </>
      }
      confirmLabel="Excluir produto"
      cancelLabel="Voltar"
      pending={remove.isPending}
      onCancel={close}
      onConfirm={() => {
        if (product !== null) remove.mutate({ id: product.id }, { onSuccess: close });
      }}
    />
  );
}
