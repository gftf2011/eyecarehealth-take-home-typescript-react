import type { UseCase } from '../../../../shared-kernel/application';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import type { OrderGateway, RequestOptions } from '../../ports/order-gateway';

export type GetOrderInput = RequestOptions & { readonly id: string };

/** Detalhe de um pedido (`404 ORDER_NOT_FOUND` chega como `ResourceNotFoundError`). */
export class GetOrderUseCase implements UseCase<GetOrderInput, OrderDto> {
  constructor(private readonly orders: OrderGateway) {}

  async execute({ id, signal }: GetOrderInput): Promise<OrderDto> {
    const order = await this.orders.findById(id, signal === undefined ? {} : { signal });
    return toOrderDto(order);
  }
}
