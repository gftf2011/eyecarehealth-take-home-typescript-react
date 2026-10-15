import { ConflictError } from '../../../../shared-kernel/domain/index';
import type { ProductId } from '../product-id';

export class ProductInUseError extends ConflictError {
  readonly code = 'PRODUCT_IN_USE';

  constructor(productId: ProductId) {
    super(
      "Não é possível remover este produto pois ele está vinculado a pedidos com status 'pending' ou 'preparing'",
      [{ productId: productId.value }],
    );
  }
}
