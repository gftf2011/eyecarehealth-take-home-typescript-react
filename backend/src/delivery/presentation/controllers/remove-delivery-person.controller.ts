import type { UseCase } from '../../../shared-kernel/application';
import {
  idParams,
  noContent,
  parseRequest,
  type Controller,
  type HttpRequest,
  type HttpResponse,
} from '../../../shared-kernel/presentation';
import type { RemoveDeliveryPersonInput } from '../../application/usecases/remove-delivery-person/remove-delivery-person.usecase';

/** DELETE /api/delivery-persons/:id */
export class RemoveDeliveryPersonController implements Controller {
  constructor(private readonly remove: UseCase<RemoveDeliveryPersonInput, void>) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const { id } = parseRequest(idParams, request.params, 'params');
    await this.remove.execute({ id });
    return noContent();
  }
}
