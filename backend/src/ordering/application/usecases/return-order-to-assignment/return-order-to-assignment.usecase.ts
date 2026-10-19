import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import { OrderId, OrderNotFoundError, ReturnReason } from '../../../domain';
import { loadDeliveryPersonSummaries, toOrderDto, type OrderDto } from '../../dtos/order.dto';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type ReturnOrderToAssignmentInput = {
  readonly id: string;
  readonly reason: string;
};

/**
 * O gestor devolve uma entrega em andamento para a atribuição (entregador sem
 * contato, acidente, veículo quebrado): o pedido volta para `ready`, sem
 * entregador, e o motivo fica no histórico. O entregador fica livre.
 *
 * Só trava o pedido: liberar o entregador nunca cria conflito (o índice único
 * só impede duas entregas em andamento, e esta deixa de existir).
 */
export class ReturnOrderToAssignmentUseCase implements UseCase<ReturnOrderToAssignmentInput, OrderDto> {
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: ReturnOrderToAssignmentInput): Promise<OrderDto> {
    const { id, reason } = validateInput({
      id: () => OrderId.from(input.id),
      reason: () => ReturnReason.create(input.reason),
    });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const order = await orders.findByIdForUpdate(id);
      if (order === null) throw new OrderNotFoundError(input.id);

      order.returnToAssignment(reason, this.clock.now());
      await orders.save(order);
      return toOrderDto(order, await loadDeliveryPersonSummaries([order], deliveryPersons));
    });
  }
}
