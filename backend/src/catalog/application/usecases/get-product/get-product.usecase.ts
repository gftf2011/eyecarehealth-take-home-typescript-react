import { validateInput, type UseCase } from '../../../../shared-kernel/application';
import { ProductId, ProductNotFoundError, type ProductVisibility } from '../../../domain';
import { toProductDto, type ProductDto } from '../../dtos/product.dto';
import type { CatalogUnitOfWork } from '../../ports/catalog-unit-of-work';

export type GetProductInput = {
  readonly id: string;
  /** Padrão: `backoffice`. */
  readonly visibility?: ProductVisibility | undefined;
};

/** Consulta um produto pelo ID. */
export class GetProductUseCase implements UseCase<GetProductInput, ProductDto> {
  constructor(private readonly unitOfWork: CatalogUnitOfWork) {}

  async execute(input: GetProductInput): Promise<ProductDto> {
    const { productId } = validateInput({ productId: () => ProductId.from(input.id) });
    const visibility = input.visibility ?? 'backoffice';

    return this.unitOfWork.transaction(async ({ products }) => {
      const product = await products.findById(productId);
      if (product === null || (visibility === 'public' && !product.isAvailable)) {
        throw new ProductNotFoundError(input.id);
      }
      return toProductDto(product);
    });
  }
}
