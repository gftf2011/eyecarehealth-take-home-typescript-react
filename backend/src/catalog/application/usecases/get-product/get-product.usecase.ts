import { validateInput, type UseCase } from '../../../../shared-kernel/application/index';
import { ProductId, ProductNotFoundError } from '../../../domain/index';
import type { ProductDto } from '../../dtos/product.dto';
import type { ProductQuery, ProductVisibility } from '../../queries/product.query';

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
