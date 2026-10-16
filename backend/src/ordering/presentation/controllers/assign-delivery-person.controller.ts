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
import type { AssignDeliveryPersonInput } from '../../application/usecases/assign-delivery-person/assign-delivery-person.usecase';

const bodySchema = z.object({ deliveryPersonId: z.string() });

/** PATCH /api/orders/:id/assign */
export class AssignDeliveryPersonController implements Controller {
  constructor(private readonly assign: UseCase<AssignDeliveryPersonInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    const { deliveryPersonId } = parseRequest(bodySchema, request.body, 'body');
    return ok(await this.assign.execute({ id, deliveryPersonId }));
  }
}
