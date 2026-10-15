import { BusinessRuleViolationError } from '../../../../shared-kernel/domain/index.js';
import type { ProductId } from '../product-id.js';

export class ProductAlreadyRemovedError extends BusinessRuleViolationError {
  readonly code = 'PRODUCT_REMOVED';

  constructor(productId: ProductId) {
    super('O produto foi removido e não pode mais ser alterado', [{ productId: productId.value }]);
  }
}
