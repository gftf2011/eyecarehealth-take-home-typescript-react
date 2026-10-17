import { z } from 'zod';

import type { UseCase } from '../../../shared-kernel/application';
import {
  ok,
  optionalBooleanQuery,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type {
  DeliveryPersonList,
  ListDeliveryPersonsInput,
} from '../../application/usecases/list-delivery-persons/list-delivery-persons.usecase';

const querySchema = z.object({
  isActive: optionalBooleanQuery,
  available: optionalBooleanQuery,
});

/** GET /api/delivery-persons */
export class ListDeliveryPersonsController implements Controller {
  constructor(private readonly listDeliveryPersons: UseCase<ListDeliveryPersonsInput, DeliveryPersonList>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const query = parseRequest(querySchema, request.query, 'query');
    return ok(await this.listDeliveryPersons.execute(query));
  }
}
