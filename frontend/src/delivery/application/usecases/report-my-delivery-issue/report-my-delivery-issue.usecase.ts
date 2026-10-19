import type { UseCase } from '../../../../shared-kernel/application';
import { parseCourierIssueInput, type CourierIssueFormInput } from '../../inputs/courier-issue.input';
import type { MyDeliveriesGateway } from '../../ports/my-deliveries-gateway';

export type ReportMyDeliveryIssueInput = CourierIssueFormInput & { readonly orderId: string };

/**
 * O entregador não conseguiu entregar e relata o motivo. O pedido continua
 * com ele: quem decide (tentar de novo, devolver, cancelar) é o gestor.
 */
export class ReportMyDeliveryIssueUseCase implements UseCase<ReportMyDeliveryIssueInput, void> {
  constructor(private readonly deliveries: MyDeliveriesGateway) {}

  async execute({ orderId, ...input }: ReportMyDeliveryIssueInput): Promise<void> {
    await this.deliveries.reportIssue(orderId, parseCourierIssueInput(input));
  }
}
