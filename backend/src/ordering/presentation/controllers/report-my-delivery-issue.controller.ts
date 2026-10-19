import type { UseCase } from '../../../shared-kernel/application';
import {
  idParams,
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { OrderDto } from '../../application/dtos/order.dto';
import type { ReportMyDeliveryIssueInput } from '../../application/usecases/report-my-delivery-issue/report-my-delivery-issue.usecase';
import { deliveryIssueBodySchema } from '../schemas/order.schemas';

/** POST /api/me/deliveries/:id/issue — o entregador relata que não conseguiu entregar. */
export class ReportMyDeliveryIssueController implements Controller {
  constructor(private readonly reportIssue: UseCase<ReportMyDeliveryIssueInput, OrderDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    const { reason, note } = parseRequest(deliveryIssueBodySchema, request.body, 'body');
    return ok(await this.reportIssue.execute({ userId: request.user.id, orderId: id, reason, note }));
  }
}
