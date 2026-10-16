import type { UseCase } from '../../../shared-kernel/application';
import {
  idParams,
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { OrderDto } from '../../application/dtos/order.dto';
import type { GetOrderInput } from '../../application/usecases/get-order/get-order.usecase';

/** GET /api/orders/:id */
export class GetOrderController implements Controller {
  constructor(private readonly getOrder: UseCase<GetOrderInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    return ok(await this.getOrder.execute({ id }));
  }
}
