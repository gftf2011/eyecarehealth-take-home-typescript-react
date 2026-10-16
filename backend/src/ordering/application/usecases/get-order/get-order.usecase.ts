import { validateInput, type UseCase } from '../../../../shared-kernel/application';
import { OrderId, OrderNotFoundError } from '../../../domain';
import { loadDeliveryPersonSummaries, toOrderDto, type OrderDto } from '../../dtos/order.dto';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type GetOrderInput = {
  readonly id: string;
};

/** Detalhe de um pedido, com itens e entregador. Leitura sem lock. */
export class GetOrderUseCase implements UseCase<GetOrderInput, OrderDto> {
  constructor(private readonly unitOfWork: OrderingUnitOfWork) {}

  async execute(input: GetOrderInput): Promise<OrderDto> {
    const { orderId } = validateInput({ orderId: () => OrderId.from(input.id) });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const order = await orders.findById(orderId);
      if (order === null) throw new OrderNotFoundError(input.id);
      return toOrderDto(order, await loadDeliveryPersonSummaries([order], deliveryPersons));
    });
  }
}
