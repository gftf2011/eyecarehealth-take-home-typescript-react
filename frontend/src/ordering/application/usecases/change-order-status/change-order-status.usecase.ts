import { validateInput, type UseCase } from '../../../../shared-kernel/application';
import { OrderStatus } from '../../../domain';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import type { OrderGateway } from '../../ports/order-gateway';

export type ChangeOrderStatusInput = {
  readonly id: string;
  readonly status: string;
};

/**
 * Muda o status de um pedido. A API é quem decide (ela trava o pedido e
 * aplica a máquina de estados): uma tela desatualizada recebe
 * `422 INVALID_STATUS_TRANSITION` ou `DELIVERY_PERSON_UNAVAILABLE`.
 */
export class ChangeOrderStatusUseCase implements UseCase<ChangeOrderStatusInput, OrderDto> {
  constructor(private readonly orders: OrderGateway) {}

  async execute(input: ChangeOrderStatusInput): Promise<OrderDto> {
    const { status } = validateInput({ status: () => OrderStatus.create(input.status) });
    const updated = await this.orders.changeStatus(input.id, status.value);
    return toOrderDto(updated);
  }
}
