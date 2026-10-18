import type { UseCase } from '../../../../shared-kernel/application';
import { toProductDto, type ProductDto } from '../../dtos/product.dto';
import { parseProductFormInput, type ProductFormInput } from '../../inputs/product-form.input';
import type { ProductGateway } from '../../ports/product-gateway';

/** Cadastra um produto. Campos inválidos são recusados antes da API, todos de uma vez. */
export class CreateProductUseCase implements UseCase<ProductFormInput, ProductDto> {
  constructor(private readonly products: ProductGateway) {}

  async execute(input: ProductFormInput): Promise<ProductDto> {
    const created = await this.products.create(parseProductFormInput(input));
    return toProductDto(created);
  }
}
