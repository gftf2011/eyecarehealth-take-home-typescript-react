import {
  validateInput,
  type Clock,
  type UseCase,
} from '../../../../shared-kernel/application';
import {
  PreparationTime,
  Product,
  ProductCategory,
  ProductDescription,
  ProductId,
  ProductName,
  ProductPrice,
} from '../../../domain';
import { toProductDto, type ProductDto } from '../../dtos/product.dto';
import { parseImageUrlInput } from '../../inputs/image-url.input';
import type { CatalogUnitOfWork } from '../../ports/catalog-unit-of-work';

export type CreateProductInput = {
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly category: string;
  /** Ausente, `null` ou em branco: produto sem imagem. */
  readonly imageUrl?: string | null | undefined;
  /** Padrão: `true`. */
  readonly isAvailable?: boolean | undefined;
  readonly preparationTime: number;
};

/** Cadastra um produto no cardápio. */
export class CreateProductUseCase implements UseCase<CreateProductInput, ProductDto> {
  constructor(
    private readonly unitOfWork: CatalogUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateProductInput): Promise<ProductDto> {
    const details = validateInput({
      name: () => ProductName.create(input.name),
      description: () => ProductDescription.create(input.description),
      price: () => ProductPrice.fromDecimal(input.price),
      category: () => ProductCategory.create(input.category),
      imageUrl: () => parseImageUrlInput(input.imageUrl) ?? null,
      preparationTime: () => PreparationTime.ofMinutes(input.preparationTime),
    });

    const product = Product.create({
      id: ProductId.generate(),
      ...details,
      isAvailable: input.isAvailable ?? true,
      now: this.clock.now(),
    });

    return this.unitOfWork.transaction(async ({ products }) => {
      await products.save(product);
      return toProductDto(product);
    });
  }
}
