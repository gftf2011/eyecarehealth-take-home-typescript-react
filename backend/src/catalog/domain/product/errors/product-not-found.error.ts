import { NotFoundError } from '../../../../shared-kernel/domain/index.js';

export class ProductNotFoundError extends NotFoundError {
  readonly code = 'PRODUCT_NOT_FOUND';

  constructor(productId: string) {
    super('Produto não encontrado', [{ productId }]);
  }
}
