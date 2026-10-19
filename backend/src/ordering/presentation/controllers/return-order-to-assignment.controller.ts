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
import type { ReturnOrderToAssignmentInput } from '../../application/usecases/return-order-to-assignment/return-order-to-assignment.usecase';
import { returnToAssignmentBodySchema } from '../schemas/order.schemas';

/** POST /api/orders/:id/return-to-assignment — a entrega volta para `ready`, sem entregador. */
export class ReturnOrderToAssignmentController implements Controller {
  constructor(private readonly returnToAssignment: UseCase<ReturnOrderToAssignmentInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    const { reason } = parseRequest(returnToAssignmentBodySchema, request.body, 'body');
    return ok(await this.returnToAssignment.execute({ id, reason }));
  }
}
