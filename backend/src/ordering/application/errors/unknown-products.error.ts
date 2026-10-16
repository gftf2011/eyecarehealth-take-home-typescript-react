import { BusinessRuleViolationError } from '../../../shared-kernel/domain';
import type { ProductId } from '../../domain';

/**
 * Pedido referencia produtos que não existem (ou foram removidos) no Catalog.
 * Usa o mesmo código de produto indisponível: para quem pede, ambos significam
 * "este produto não pode entrar no pedido"; o `reason` diferencia os casos.
 */
export class UnknownProductsError extends BusinessRuleViolationError {
  readonly code = 'UNAVAILABLE_PRODUCT';

  constructor(productIds: readonly ProductId[]) {
    super(
      'Um ou mais produtos não estão disponíveis',
      productIds.map((productId) => ({
        productId: productId.value,
        productName: null,
        reason: 'Produto não encontrado',
      })),
    );
  }
}
