import type { Page, UseCase } from '../../../shared-kernel/application';
import {
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { OrderDto } from '../../application/dtos/order.dto';
import type { ListOrdersInput } from '../../application/usecases/list-orders/list-orders.usecase';
import { listOrdersQuerySchema } from '../schemas/order.schemas';

/** GET /api/orders */
export class ListOrdersController implements Controller {
  constructor(private readonly listOrders: UseCase<ListOrdersInput, Page<OrderDto>>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const query = parseRequest(listOrdersQuerySchema, request.query, 'query');
    return ok(await this.listOrders.execute(query));
  }
}
