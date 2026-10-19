import type { UseCase } from '../../../shared-kernel/application';
import {
  idParams,
  ok,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { DeliveryPersonDto } from '../../application/dtos/delivery-person.dto';
import type { UpdateDeliveryPersonInput } from '../../application/usecases/update-delivery-person/update-delivery-person.usecase';
import { updateDeliveryPersonBodySchema } from '../schemas/delivery.schemas';

/** Todos os campos são opcionais: só os enviados são alterados. */

/** PUT /api/delivery-persons/:id */
export class UpdateDeliveryPersonController implements Controller {
  constructor(private readonly update: UseCase<UpdateDeliveryPersonInput, DeliveryPersonDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    const body = parseRequest(updateDeliveryPersonBodySchema, request.body, 'body');
    return ok(await this.update.execute({ id, ...body }));
  }
}
