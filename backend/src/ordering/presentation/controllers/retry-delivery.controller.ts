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
import type { RetryDeliveryInput } from '../../application/usecases/retry-delivery/retry-delivery.usecase';

/** POST /api/orders/:id/delivery-issue/retry — decisão do gestor sobre a entrega com problema. */
export class RetryDeliveryController implements Controller {
  constructor(private readonly retryDelivery: UseCase<RetryDeliveryInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    return ok(await this.retryDelivery.execute({ id }));
  }
}
