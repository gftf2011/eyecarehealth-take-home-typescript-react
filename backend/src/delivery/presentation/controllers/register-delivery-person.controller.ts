import { z } from 'zod';

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

const bodySchema = z.object({
  name: z.string(),
  phone: z.string(),
  vehicleType: z.string(),
  isActive: z.boolean().optional(),
  currentLatitude: z.number().nullable().optional(),
  currentLongitude: z.number().nullable().optional(),
});

/** POST /api/delivery-persons */
export class RegisterDeliveryPersonController implements Controller {
  constructor(private readonly register: UseCase<RegisterDeliveryPersonInput, DeliveryPersonDto>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const body = parseRequest(bodySchema, request.body, 'body');
    return created(await this.register.execute(body));
  }
}
