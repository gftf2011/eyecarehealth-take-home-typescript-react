import { z } from 'zod';

import type { Page, UseCase } from '../../../shared-kernel/application';
import {
  ok,
  optionalIntegerQuery,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { OrderDto } from '../../application/dtos/order.dto';
import type { ListOrdersInput } from '../../application/usecases/list-orders/list-orders.usecase';

const querySchema = z.object({
  page: optionalIntegerQuery,
  limit: optionalIntegerQuery,
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.string().optional(),
});

/** GET /api/orders */
export class ListOrdersController implements Controller {
  constructor(private readonly listOrders: UseCase<ListOrdersInput, Page<OrderDto>>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const query = parseRequest(querySchema, request.query, 'query');
    return ok(await this.listOrders.execute(query));
  }
}
