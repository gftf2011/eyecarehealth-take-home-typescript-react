import type { UseCase } from '../../../shared-kernel/application';
import {
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { OrdersByStatusReportDto } from '../../application/dtos/report.dtos';
import type { GetOrdersByStatusReportInput } from '../../application/usecases/get-orders-by-status-report/get-orders-by-status-report.usecase';
import { periodQuerySchema } from './period-query';

/** GET /api/reports/orders-by-status */
export class GetOrdersByStatusReportController implements Controller {
  constructor(
    private readonly getOrdersByStatus: UseCase<GetOrdersByStatusReportInput, OrdersByStatusReportDto>,
  ) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const query = parseRequest(periodQuerySchema, request.query, 'query');
    return ok(await this.getOrdersByStatus.execute(query));
  }
}
