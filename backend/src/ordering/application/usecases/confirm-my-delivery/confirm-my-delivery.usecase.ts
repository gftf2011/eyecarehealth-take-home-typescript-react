import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import { OrderId, OrderNotFoundError, OrderStatus } from '../../../domain';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import { DeliveryPersonNotLinkedError } from '../../errors/delivery-person-not-linked.error';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type ConfirmMyDeliveryInput = {
  /** Usuário logado (do token). */
  readonly userId: string;
  readonly orderId: string;
};

const DELIVERED = OrderStatus.of('delivered');

/**
 * O entregador confirma que entregou (`delivering → delivered`). **Só o dono**:
 * pedido de outro entregador responde como inexistente (`404`), para não
 * revelar que o pedido existe. Um pedido dele que ainda não saiu, ou já
 * terminou, é recusado pela máquina de estados (`422`).
 */
export class ConfirmMyDeliveryUseCase implements UseCase<ConfirmMyDeliveryInput, OrderDto> {
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: ConfirmMyDeliveryInput): Promise<OrderDto> {
    const { orderId } = validateInput({ orderId: () => OrderId.from(input.orderId) });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const me = await deliveryPersons.deliveryPersonOfUser(input.userId);
      if (me === null) throw new DeliveryPersonNotLinkedError();

      const order = await orders.findByIdForUpdate(orderId);
      if (order?.deliveryPersonId?.value !== me.id) throw new OrderNotFoundError(input.orderId);

      order.changeStatus(DELIVERED, this.clock.now());
      await orders.save(order);
      return toOrderDto(order, new Map([[me.id, me]]));
    });
  }
}
