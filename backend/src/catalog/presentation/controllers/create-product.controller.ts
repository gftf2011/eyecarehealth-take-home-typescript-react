import type { UseCase } from '../../../shared-kernel/application';
import {
  created,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { ProductDto } from '../../application/dtos/product.dto';
import type { CreateProductInput } from '../../application/usecases/create-product/create-product.usecase';
import { createProductBodySchema } from '../schemas/product.schemas';

/** POST /api/products */
export class CreateProductController implements Controller {
  constructor(private readonly createProduct: UseCase<CreateProductInput, ProductDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const body = parseRequest(createProductBodySchema, request.body, 'body');
    return created(await this.createProduct.execute(body));
  }
}
