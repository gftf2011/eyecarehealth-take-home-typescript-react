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
import type { ChangeOrderStatusInput } from '../../application/usecases/change-order-status/change-order-status.usecase';
import { changeOrderStatusBodySchema } from '../schemas/order.schemas';

/** PATCH /api/orders/:id/status */
export class ChangeOrderStatusController implements Controller {
  constructor(private readonly changeStatus: UseCase<ChangeOrderStatusInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    const { status } = parseRequest(changeOrderStatusBodySchema, request.body, 'body');
    return ok(await this.changeStatus.execute({ id, status }));
  }
}
