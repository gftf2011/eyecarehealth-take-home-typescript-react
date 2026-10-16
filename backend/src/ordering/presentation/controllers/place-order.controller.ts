import { z } from 'zod';

import type { UseCase } from '../../../shared-kernel/application';
import {
  created,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { OrderDto } from '../../application/dtos/order.dto';
import type { PlaceOrderInput } from '../../application/usecases/place-order/place-order.usecase';

/** Só o formato; o limite de itens e as regras dos valores ficam no caso de uso. */
const bodySchema = z.object({
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryAddress: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number() })),
});

/** POST /api/orders — o total nunca vem do cliente: é calculado pelo backend. */
export class PlaceOrderController implements Controller {
  constructor(private readonly placeOrder: UseCase<PlaceOrderInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const body = parseRequest(bodySchema, request.body, 'body');
    return created(await this.placeOrder.execute(body));
  }
}
