import type { UseCase } from '../../../shared-kernel/application';
import {
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { RevenueReportDto } from '../../application/dtos/report.dtos';
import type { GetRevenueReportInput } from '../../application/usecases/get-revenue-report/get-revenue-report.usecase';
import { periodQuerySchema } from '../schemas/report.schemas';

/** GET /api/reports/revenue */
export class GetRevenueReportController implements Controller {
  constructor(private readonly getRevenue: UseCase<GetRevenueReportInput, RevenueReportDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const query = parseRequest(periodQuerySchema, request.query, 'query');
    return ok(await this.getRevenue.execute(query));
  }
}
