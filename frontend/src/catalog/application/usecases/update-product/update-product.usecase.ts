import type { UseCase } from '../../../../shared-kernel/application';
import { toProductDto, type ProductDto } from '../../dtos/product.dto';
import { parseProductFormInput, type ProductFormInput } from '../../inputs/product-form.input';
import type { ProductGateway } from '../../ports/product-gateway';

export type UpdateProductInput = ProductFormInput & { readonly id: string };

/**
 * Salva o formulário de edição. Envia todos os campos validados: imagem em
 * branco remove a imagem. `404` (produto removido por outro gestor) chega
 * como `ResourceNotFoundError`.
 */
export class UpdateProductUseCase implements UseCase<UpdateProductInput, ProductDto> {
  constructor(private readonly products: ProductGateway) {}

  async execute({ id, ...input }: UpdateProductInput): Promise<ProductDto> {
    const updated = await this.products.update(id, parseProductFormInput(input));
    return toProductDto(updated);
  }
}
