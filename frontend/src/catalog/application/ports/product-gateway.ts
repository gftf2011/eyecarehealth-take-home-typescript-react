import type { Page } from '../../../shared-kernel/application';
import type { Product, ProductDetails, ProductListCriteria } from '../../domain';

export type RequestOptions = {
  readonly signal?: AbortSignal;
};

/** Produtos na API (`/products`): a fonte da verdade, que valida tudo de novo. */
export interface ProductGateway {
  list(criteria: ProductListCriteria, options?: RequestOptions): Promise<Page<Product>>;
  create(details: ProductDetails): Promise<Product>;
  /** Atualização parcial: só os campos informados mudam (`imageUrl: null` remove a imagem). */
  update(id: string, changes: Partial<ProductDetails>): Promise<Product>;
  /** Soft delete; `409 PRODUCT_IN_USE` se o produto estiver em pedido aberto. */
  remove(id: string): Promise<void>;
}
