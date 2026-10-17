import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import {
  DeliveryPersonId,
  InvalidStatusTransitionError,
  OrderId,
  OrderNotFoundError,
  OrderStatus,
} from '../../../domain';
import { loadDeliveryPersonSummaries, toOrderDto, type OrderDto } from '../../dtos/order.dto';
import { DeliveryPersonNotFoundError } from '../../errors/delivery-person-not-found.error';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

const DELIVERING = OrderStatus.of('delivering');

export type DispatchOrderInput = {
  readonly id: string;
  readonly deliveryPersonId: string;
};

/**
 * Despacha um pedido `ready` com o entregador informado: atribui e passa para
 * `delivering` na mesma transação. É o "aceitar" da atribuição sugerida pela
 * otimização — e serve a qualquer tela que despache direto.
 *
 * A sugestão pode estar velha: pedido que saiu de `ready` ou entregador que
 * ficou ocupado/inativo fazem a transação inteira ser desfeita (422).
 */
export class DispatchOrderUseCase implements UseCase<DispatchOrderInput, OrderDto> {
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: DispatchOrderInput): Promise<OrderDto> {
    const { orderId, deliveryPersonId } = validateInput({
      orderId: () => OrderId.from(input.id),
      deliveryPersonId: () => DeliveryPersonId.from(input.deliveryPersonId),
    });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      // Ordem de lock: pedido → entregador (a mesma dos outros casos de uso).
      const order = await orders.findByIdForUpdate(orderId);
      if (order === null) throw new OrderNotFoundError(input.id);
      // Despachar só existe a partir de `ready`: a falha é da transição, não da
      // atribuição (que, sozinha, também valeria para `pending`/`preparing`).
      if (!order.status.canTransitionTo(DELIVERING)) {
        throw new InvalidStatusTransitionError(order.status.value, DELIVERING.value);
      }

      const availability = await deliveryPersons.availabilityOf(deliveryPersonId);
      if (availability === null) throw new DeliveryPersonNotFoundError(deliveryPersonId);

      const now = this.clock.now();
      order.assignDeliveryPerson(availability, now);
      order.dispatch(availability, now);

      await orders.save(order);
      return toOrderDto(order, await loadDeliveryPersonSummaries([order], deliveryPersons));
    });
  }
}
