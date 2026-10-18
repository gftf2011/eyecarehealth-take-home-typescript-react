import type { UseCase } from '../../../../shared-kernel/application';
import type { ProductGateway } from '../../ports/product-gateway';

export type RemoveProductInput = { readonly id: string };

/**
 * Remove o produto do cardápio (soft delete). Produto em pedido `pending` ou
 * `preparing` é recusado pela API com `409 PRODUCT_IN_USE`.
 */
export class RemoveProductUseCase implements UseCase<RemoveProductInput, void> {
  constructor(private readonly products: ProductGateway) {}

  execute({ id }: RemoveProductInput): Promise<void> {
    return this.products.remove(id);
  }
}
