import { BusinessRuleViolationError } from '../../../../shared-kernel/domain/index.js';
import type { ProductSnapshot } from '../value-objects/product-snapshot.js';

export class UnavailableProductError extends BusinessRuleViolationError {
  readonly code = 'UNAVAILABLE_PRODUCT';

  constructor(products: readonly ProductSnapshot[]) {
    super(
      'Um ou mais produtos não estão disponíveis',
      products.map((product) => ({
        productId: product.productId.value,
        productName: product.name,
        reason: 'Produto indisponível',
      })),
    );
  }
}
