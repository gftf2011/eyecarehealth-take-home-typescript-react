import type { UseCase } from '../../../shared-kernel/application';
import { ok, parseRequest, type Controller, type HttpRequest, type HttpResponse } from '../../../shared-kernel/presentation';
import type { DeliveryPersonDto } from '../../application/dtos/delivery-person.dto';
import type { UpdateMyLocationInput } from '../../application/usecases/update-my-location/update-my-location.usecase';
import { myLocationBodySchema } from '../schemas/delivery.schemas';

/** PUT /api/me/location — o entregador logado informa onde está (o dono vem do token). */
export class UpdateMyLocationController implements Controller {
  constructor(private readonly updateMyLocation: UseCase<UpdateMyLocationInput, DeliveryPersonDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { latitude, longitude } = parseRequest(myLocationBodySchema, request.body, 'body');
    return ok(await this.updateMyLocation.execute({ userId: request.user.id, latitude, longitude }));
  }
}
