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
import type { CancelFailedDeliveryInput } from '../../application/usecases/cancel-failed-delivery/cancel-failed-delivery.usecase';

/** POST /api/orders/:id/delivery-issue/cancel — decisão do gestor sobre a entrega com problema. */
export class CancelFailedDeliveryController implements Controller {
  constructor(private readonly cancelFailedDelivery: UseCase<CancelFailedDeliveryInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    return ok(await this.cancelFailedDelivery.execute({ id }));
  }
}
