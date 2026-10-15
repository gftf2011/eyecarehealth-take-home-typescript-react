import {
  validateInput,
  type Clock,
  type UseCase,
} from '../../../../shared-kernel/application';
import {
  PreparationTime,
  ProductCategory,
  ProductDescription,
  ProductId,
  ProductName,
  ProductNotFoundError,
  ProductPrice,
  type Product,
} from '../../../domain';
import { toProductDto, type ProductDto } from '../../dtos/product.dto';
import { parseImageUrlInput } from '../../inputs/image-url.input';
import type { CatalogUnitOfWork } from '../../ports/catalog-unit-of-work';

/** Atualização parcial: só os campos enviados são alterados. */
export type UpdateProductInput = {
  readonly id: string;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly price?: number | undefined;
  readonly category?: string | undefined;
  /** `null` ou em branco remove a imagem. */
  readonly imageUrl?: string | null | undefined;
  readonly isAvailable?: boolean | undefined;
  readonly preparationTime?: number | undefined;
};

/** Atualiza os dados de um produto do cardápio. */
export class UpdateProductUseCase implements UseCase<UpdateProductInput, ProductDto> {
  constructor(
    private readonly unitOfWork: CatalogUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateProductInput): Promise<ProductDto> {
    const { productId, ...changes } = validateInput({
      productId: () => ProductId.from(input.id),
      name: () => optional(input.name, ProductName.create),
      description: () => optional(input.description, ProductDescription.create),
      price: () => optional(input.price, ProductPrice.fromDecimal),
      category: () => optional(input.category, ProductCategory.create),
      imageUrl: () => parseImageUrlInput(input.imageUrl),
      preparationTime: () => optional(input.preparationTime, PreparationTime.ofMinutes),
    });

    return this.unitOfWork.transaction(async ({ products }) => {
      const product = await products.findById(productId);
      if (product === null) throw new ProductNotFoundError(input.id);

      const now = this.clock.now();
      product.updateDetails(changes, now);
      if (input.isAvailable !== undefined) changeAvailability(product, input.isAvailable, now);

      await products.save(product);
      return toProductDto(product);
    });
  }
}

function optional<TRaw, TValue>(
  raw: TRaw | undefined,
  create: (value: TRaw) => TValue,
): TValue | undefined {
  return raw === undefined ? undefined : create(raw);
}

function changeAvailability(product: Product, isAvailable: boolean, now: Date): void {
  if (isAvailable) product.makeAvailable(now);
  else product.makeUnavailable(now);
}
