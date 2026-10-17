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
import type { OrderDto } from '../../application/dtos/order.dto';
import type { DispatchOrderInput } from '../../application/usecases/dispatch-order/dispatch-order.usecase';

const bodySchema = z.object({ deliveryPersonId: z.string() });

/** POST /api/orders/:id/dispatch — atribui e despacha (aceitar a sugestão). */
export class DispatchOrderController implements Controller {
  constructor(private readonly dispatchOrder: UseCase<DispatchOrderInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    const { deliveryPersonId } = parseRequest(bodySchema, request.body, 'body');
    return ok(await this.dispatchOrder.execute({ id, deliveryPersonId }));
  }
}
