import type { UseCase } from '../../../../shared-kernel/application';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import { parseReturnToAssignmentInput } from '../../inputs/return-to-assignment.input';
import type { OrderGateway } from '../../ports/order-gateway';

export type ReturnOrderToAssignmentInput = {
  readonly id: string;
  readonly reason: string;
};

/**
 * Devolve uma entrega em andamento para a atribuição: o pedido volta para
 * `ready`, sem entregador, e o motivo fica no histórico. Motivo inválido é
 * recusado antes da API; um pedido que já saiu de `delivering` em outra aba
 * volta com `422 INVALID_STATUS_TRANSITION`.
 */
export class ReturnOrderToAssignmentUseCase implements UseCase<ReturnOrderToAssignmentInput, OrderDto> {
  constructor(private readonly orders: OrderGateway) {}

  async execute(input: ReturnOrderToAssignmentInput): Promise<OrderDto> {
    const { reason } = parseReturnToAssignmentInput(input);
    const returned = await this.orders.returnToAssignment(input.id, reason);
    return toOrderDto(returned);
  }
}
