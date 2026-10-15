import { BusinessRuleViolationError } from '../../../../shared-kernel/domain';
import type { ProductId } from '../product-id';

export class ProductAlreadyRemovedError extends BusinessRuleViolationError {
  readonly code = 'PRODUCT_REMOVED';

  constructor(productId: ProductId) {
    super('O produto foi removido e não pode mais ser alterado', [{ productId: productId.value }]);
  }
}
