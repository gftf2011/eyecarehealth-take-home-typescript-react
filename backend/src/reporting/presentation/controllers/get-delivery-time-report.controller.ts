import type { UseCase } from '../../../shared-kernel/application';
import {
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { DeliveryTimeReportDto } from '../../application/dtos/report.dtos';
import type { GetDeliveryTimeReportInput } from '../../application/usecases/get-delivery-time-report/get-delivery-time-report.usecase';
import { periodQuerySchema } from '../schemas/report.schemas';

/** GET /api/reports/average-delivery-time */
export class GetDeliveryTimeReportController implements Controller {
  constructor(
    private readonly getDeliveryTime: UseCase<GetDeliveryTimeReportInput, DeliveryTimeReportDto>,
  ) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const query = parseRequest(periodQuerySchema, request.query, 'query');
    return ok(await this.getDeliveryTime.execute(query));
  }
}
