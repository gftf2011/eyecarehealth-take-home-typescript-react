import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import { OrderId, OrderNotFoundError } from '../../../domain';
import { loadDeliveryPersonSummaries, toOrderDto, type OrderDto } from '../../dtos/order.dto';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type CancelFailedDeliveryInput = { readonly id: string };

/** O gestor cancela a entrega que falhou (`delivering → cancelled`), com o motivo relatado no histórico. Só existe com um problema aberto (`422 NO_OPEN_DELIVERY_ISSUE`). */
export class CancelFailedDeliveryUseCase implements UseCase<CancelFailedDeliveryInput, OrderDto> {
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: CancelFailedDeliveryInput): Promise<OrderDto> {
    const { id } = validateInput({ id: () => OrderId.from(input.id) });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const order = await orders.findByIdForUpdate(id);
      if (order === null) throw new OrderNotFoundError(input.id);

      order.cancelFailedDelivery(this.clock.now());
      await orders.save(order);
      return toOrderDto(order, await loadDeliveryPersonSummaries([order], deliveryPersons));
    });
  }
}
