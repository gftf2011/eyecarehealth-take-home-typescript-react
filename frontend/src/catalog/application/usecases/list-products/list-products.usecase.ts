import { mapPage, type Page, type UseCase } from '../../../../shared-kernel/application';
import { toProductDto, type ProductDto } from '../../dtos/product.dto';
import { parseListProductsInput, type ListProductsInput } from '../../inputs/list-products.input';
import type { ProductGateway, RequestOptions } from '../../ports/product-gateway';

/** Lista produtos do painel (inclusive indisponíveis) com busca por nome, filtros e ordenação. */
export class ListProductsUseCase implements UseCase<ListProductsInput & RequestOptions, Page<ProductDto>> {
  constructor(private readonly products: ProductGateway) {}

  async execute({ signal, ...input }: ListProductsInput & RequestOptions): Promise<Page<ProductDto>> {
    const criteria = parseListProductsInput(input);
    const page = await this.products.list(criteria, signal === undefined ? {} : { signal });
    return mapPage(page, toProductDto);
  }
}
