import { UniqueId } from '../../../../shared-kernel/domain/index.js';

/**
 * Referência a um produto do contexto Catalog. É um tipo próprio do Ordering:
 * os contextos compartilham só o valor do UUID, nunca classes de domínio.
 */
export class ProductId extends UniqueId {
  declare private readonly brand: 'Ordering.ProductId';

  static from(raw: string): ProductId {
    return new ProductId(raw, 'productId');
  }
}
