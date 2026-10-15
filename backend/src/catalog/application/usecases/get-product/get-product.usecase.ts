import { validateInput, type UseCase } from '../../../../shared-kernel/application/index.js';
import { ProductId, ProductNotFoundError } from '../../../domain/index.js';
import type { ProductDto } from '../../dtos/product.dto.js';
import type { ProductQuery, ProductVisibility } from '../../queries/product.query.js';

export type GetProductInput = {
  readonly id: string;
  /** Padrão: `backoffice`. */
  readonly visibility?: ProductVisibility | undefined;
};

/** Consulta um produto pelo ID. */
export class GetProductUseCase implements UseCase<GetProductInput, ProductDto> {
  constructor(private readonly products: ProductQuery) {}

  async execute(input: GetProductInput): Promise<ProductDto> {
    const { productId } = validateInput({ productId: () => ProductId.from(input.id) });

    const product = await this.products.findById(productId);
    const visibility = input.visibility ?? 'backoffice';
    if (product === null || (visibility === 'public' && !product.isAvailable)) {
      throw new ProductNotFoundError(input.id);
    }
    return product;
  }
}
