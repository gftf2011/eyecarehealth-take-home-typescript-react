import type { UseCase } from '../../../shared-kernel/application';
import {
  idParams,
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { ProductDto } from '../../application/dtos/product.dto';
import type { GetProductInput } from '../../application/usecases/get-product/get-product.usecase';

/** GET /api/products/:id — painel (admin/viewer): vê também indisponíveis. */
export class GetProductController implements Controller {
  constructor(private readonly getProduct: UseCase<GetProductInput, ProductDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    return ok(await this.getProduct.execute({ id, visibility: 'backoffice' }));
  }
}
