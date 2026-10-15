import {
  validateInput,
  type Clock,
  type UseCase,
} from '../../../../shared-kernel/application/index.js';
import { ProductId, ProductNotFoundError } from '../../../domain/index.js';
import type { CatalogUnitOfWork } from '../../ports/catalog-unit-of-work.js';

export type RemoveProductInput = {
  readonly id: string;
};

/**
 * Remove (soft delete) um produto do cardápio. Produto em pedido `pending` ou
 * `preparing` não pode ser removido; pedidos antigos continuam referenciando-o.
 */
export class RemoveProductUseCase implements UseCase<RemoveProductInput, void> {
  constructor(
    private readonly unitOfWork: CatalogUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveProductInput): Promise<void> {
    const { productId } = validateInput({ productId: () => ProductId.from(input.id) });

    await this.unitOfWork.transaction(async ({ products, activeOrders }) => {
      const product = await products.findById(productId);
      if (product === null) throw new ProductNotFoundError(input.id);

      const hasActiveOrders = await activeOrders.hasActiveOrdersFor(productId);
      product.remove({ hasActiveOrders, now: this.clock.now() });

      await products.save(product);
    });
  }
}
