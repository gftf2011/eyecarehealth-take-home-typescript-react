import type { UseCase } from '../../../../shared-kernel/application';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import type { DeliveryIssueDecision, OrderGateway } from '../../ports/order-gateway';

export type ResolveDeliveryIssueInput = {
  readonly id: string;
  readonly decision: DeliveryIssueDecision;
};

/**
 * O gestor decide sobre a entrega que o entregador não conseguiu fazer:
 * tentar de novo (o entregador segue com o pedido) ou cancelar o pedido. A
 * terceira saída, devolver para a atribuição, é `ReturnOrderToAssignment`.
 */
export class ResolveDeliveryIssueUseCase implements UseCase<ResolveDeliveryIssueInput, OrderDto> {
  constructor(private readonly orders: OrderGateway) {}

  async execute({ id, decision }: ResolveDeliveryIssueInput): Promise<OrderDto> {
    return toOrderDto(await this.orders.resolveDeliveryIssue(id, decision));
  }
}
