import type { Page, UseCase } from '../../../shared-kernel/application';
import {
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { ProductDto } from '../../application/dtos/product.dto';
import type { ListProductsInput } from '../../application/usecases/list-products/list-products.usecase';
import { listProductsQuerySchema } from '../schemas/product.schemas';

/** GET /api/products — painel (admin/viewer): lista também indisponíveis. */
export class ListProductsController implements Controller {
  constructor(private readonly listProducts: UseCase<ListProductsInput, Page<ProductDto>>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const query = parseRequest(listProductsQuerySchema, request.query, 'query');
    return ok(await this.listProducts.execute({ ...query, visibility: 'backoffice' }));
  }
}
