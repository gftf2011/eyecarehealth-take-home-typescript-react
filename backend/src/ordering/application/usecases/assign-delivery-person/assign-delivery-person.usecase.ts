import {
  validateInput,
  type Clock,
  type UseCase,
} from '../../../../shared-kernel/application';
import { DeliveryPersonId, OrderId, OrderNotFoundError } from '../../../domain';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import { DeliveryPersonNotFoundError } from '../../errors/delivery-person-not-found.error';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type AssignDeliveryPersonInput = {
  readonly id: string;
  readonly deliveryPersonId: string;
};

/**
 * Atribui (ou troca) o entregador de um pedido ainda não despachado. O
 * entregador precisa existir, estar ativo e não ter pedido `delivering`; a
 * disponibilidade é lida do Delivery na mesma transação, com o entregador
 * travado. Atribuir o mesmo entregador de novo não altera nada.
 */
export class AssignDeliveryPersonUseCase implements UseCase<AssignDeliveryPersonInput, OrderDto> {
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: AssignDeliveryPersonInput): Promise<OrderDto> {
    const { orderId, deliveryPersonId } = validateInput({
      orderId: () => OrderId.from(input.id),
      deliveryPersonId: () => DeliveryPersonId.from(input.deliveryPersonId),
    });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const order = await orders.findById(orderId);
      if (order === null) throw new OrderNotFoundError(input.id);

      const availability = await deliveryPersons.availabilityOf(deliveryPersonId);
      if (availability === null) throw new DeliveryPersonNotFoundError(deliveryPersonId);

      order.assignDeliveryPerson(availability, this.clock.now());

      await orders.save(order);
      return toOrderDto(order);
    });
  }
}
