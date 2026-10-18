import type { UseCase } from '../../../../shared-kernel/application';
import { toProductDto, type ProductDto } from '../../dtos/product.dto';
import type { ProductGateway } from '../../ports/product-gateway';

export type SetProductAvailabilityInput = {
  readonly id: string;
  readonly isAvailable: boolean;
};

/** Liga/desliga a disponibilidade direto da listagem (só esse campo é enviado). */
export class SetProductAvailabilityUseCase implements UseCase<SetProductAvailabilityInput, ProductDto> {
  constructor(private readonly products: ProductGateway) {}

  async execute({ id, isAvailable }: SetProductAvailabilityInput): Promise<ProductDto> {
    const updated = await this.products.update(id, { isAvailable });
    return toProductDto(updated);
  }
}
