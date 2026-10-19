import type { UseCase } from '../../../shared-kernel/application';
import {
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { TopProductsReportDto } from '../../application/dtos/report.dtos';
import type { GetTopProductsReportInput } from '../../application/usecases/get-top-products-report/get-top-products-report.usecase';
import { topProductsQuerySchema } from '../schemas/report.schemas';

/** GET /api/reports/top-products */
export class GetTopProductsReportController implements Controller {
  constructor(private readonly getTopProducts: UseCase<GetTopProductsReportInput, TopProductsReportDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const query = parseRequest(topProductsQuerySchema, request.query, 'query');
    return ok(await this.getTopProducts.execute(query));
  }
}
