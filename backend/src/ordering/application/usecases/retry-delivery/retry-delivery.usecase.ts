import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import { OrderId, OrderNotFoundError } from '../../../domain';
import { loadDeliveryPersonSummaries, toOrderDto, type OrderDto } from '../../dtos/order.dto';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type RetryDeliveryInput = { readonly id: string };

/** O gestor manda o entregador tentar de novo: o problema relatado termina e a entrega segue com ele. */
export class RetryDeliveryUseCase implements UseCase<RetryDeliveryInput, OrderDto> {
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: RetryDeliveryInput): Promise<OrderDto> {
    const { id } = validateInput({ id: () => OrderId.from(input.id) });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const order = await orders.findByIdForUpdate(id);
      if (order === null) throw new OrderNotFoundError(input.id);

      order.retryDelivery(this.clock.now());
      await orders.save(order);
      return toOrderDto(order, await loadDeliveryPersonSummaries([order], deliveryPersons));
    });
  }
}
