import {
  validateInput,
  type Clock,
  type UseCase,
} from '../../../../shared-kernel/application';
import { OrderId, OrderNotFoundError, OrderStatus, type Order } from '../../../domain';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import { AssignedDeliveryPersonUnavailableError } from '../../errors/assigned-delivery-person-unavailable.error';
import type { OrderingRepositories, OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type ChangeOrderStatusInput = {
  readonly id: string;
  readonly status: string;
};

/**
 * Altera o status de um pedido seguindo a máquina de estados. A ida para
 * `delivering` é o despacho: confirma, na mesma transação, que o entregador
 * atribuído continua ativo e sem outra entrega em andamento.
 */
export class ChangeOrderStatusUseCase implements UseCase<ChangeOrderStatusInput, OrderDto> {
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: ChangeOrderStatusInput): Promise<OrderDto> {
    const { orderId, status } = validateInput({
      orderId: () => OrderId.from(input.id),
      status: () => OrderStatus.create(input.status),
    });

    return this.unitOfWork.transaction(async (repositories) => {
      const order = await repositories.orders.findById(orderId);
      if (order === null) throw new OrderNotFoundError(input.id);

      const now = this.clock.now();
      if (status.is('delivering')) await dispatch(order, repositories, now);
      else order.changeStatus(status, now);

      await repositories.orders.save(order);
      return toOrderDto(order);
    });
  }
}

async function dispatch(
  order: Order,
  { deliveryPersons }: OrderingRepositories,
  now: Date,
): Promise<void> {
  // Falha cedo (sem consultar nem travar o entregador) se o pedido não pode ser despachado.
  const assigned = order.ensureDispatchable();
  const availability = await deliveryPersons.availabilityOf(assigned);
  if (availability === null) throw new AssignedDeliveryPersonUnavailableError(assigned);
  order.dispatch(availability, now);
}
