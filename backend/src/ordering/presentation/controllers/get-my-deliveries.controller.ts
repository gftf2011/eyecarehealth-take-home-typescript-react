import type { UseCase } from '../../../shared-kernel/application';
import { ok, type Controller, type HttpRequest, type HttpResponse } from '../../../shared-kernel/presentation';
import type { MyDeliveriesDto } from '../../application/dtos/my-deliveries.dto';
import type { GetMyDeliveriesInput } from '../../application/usecases/get-my-deliveries/get-my-deliveries.usecase';

/** GET /api/me/deliveries — as entregas do entregador logado (o dono vem do token). */
export class GetMyDeliveriesController implements Controller {
  constructor(private readonly getMyDeliveries: UseCase<GetMyDeliveriesInput, MyDeliveriesDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    return ok(await this.getMyDeliveries.execute({ userId: request.user.id }));
  }
}
