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
import type { UpdateProductInput } from '../../application/usecases/update-product/update-product.usecase';
import { updateProductBodySchema } from '../schemas/product.schemas';

/** Todos os campos são opcionais: só os enviados são alterados. */

/** PUT /api/products/:id */
export class UpdateProductController implements Controller {
  constructor(private readonly updateProduct: UseCase<UpdateProductInput, ProductDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    const body = parseRequest(updateProductBodySchema, request.body, 'body');
    return ok(await this.updateProduct.execute({ id, ...body }));
  }
}
