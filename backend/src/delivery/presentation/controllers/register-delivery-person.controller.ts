import type { UseCase } from '../../../shared-kernel/application';
import {
  created,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { DeliveryPersonDto } from '../../application/dtos/delivery-person.dto';
import type { RegisterDeliveryPersonInput } from '../../application/usecases/register-delivery-person/register-delivery-person.usecase';
import { registerDeliveryPersonBodySchema } from '../schemas/delivery.schemas';

/** POST /api/delivery-persons */
export class RegisterDeliveryPersonController implements Controller {
  constructor(private readonly register: UseCase<RegisterDeliveryPersonInput, DeliveryPersonDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const body = parseRequest(registerDeliveryPersonBodySchema, request.body, 'body');
    return created(await this.register.execute(body));
  }
}
