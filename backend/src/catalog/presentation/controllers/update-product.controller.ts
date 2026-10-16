import { z } from 'zod';

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

/** Todos os campos são opcionais: só os enviados são alterados. */
const bodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.number().optional(),
  category: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  isAvailable: z.boolean().optional(),
  preparationTime: z.number().optional(),
});

/** PUT /api/products/:id */
export class UpdateProductController implements Controller {
  constructor(private readonly updateProduct: UseCase<UpdateProductInput, ProductDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    const body = parseRequest(bodySchema, request.body, 'body');
    return ok(await this.updateProduct.execute({ id, ...body }));
  }
}
