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
import type { ConfirmMyDeliveryInput } from '../../application/usecases/confirm-my-delivery/confirm-my-delivery.usecase';

/** POST /api/me/deliveries/:id/delivered — o entregador confirma a própria entrega. */
export class ConfirmMyDeliveryController implements Controller {
  constructor(private readonly confirmMyDelivery: UseCase<ConfirmMyDeliveryInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    return ok(await this.confirmMyDelivery.execute({ userId: request.user.id, orderId: id }));
  }
}
