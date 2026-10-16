import type { UseCase } from '../../../shared-kernel/application';
import {
  idParams,
  noContent,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { RemoveProductInput } from '../../application/usecases/remove-product/remove-product.usecase';

/** DELETE /api/products/:id */
export class RemoveProductController implements Controller {
  constructor(private readonly removeProduct: UseCase<RemoveProductInput, void>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    await this.removeProduct.execute({ id });
    return noContent();
  }
}
