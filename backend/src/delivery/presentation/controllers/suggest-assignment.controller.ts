import type { UseCase } from '../../../shared-kernel/application';
import { ok, type Controller, type HttpResponse } from '../../../shared-kernel/presentation';
import type { AssignmentSuggestionDto } from '../../application/dtos/assignment-suggestion.dto';

/**
 * POST /api/orders/optimize-assignment — sem corpo: o algoritmo busca os
 * pedidos `ready` e os entregadores disponíveis.
 */
export class SuggestAssignmentController implements Controller {
  constructor(private readonly suggest: UseCase<void, AssignmentSuggestionDto>) {}

  async handle(): Promise<HttpResponse> {
    return ok(await this.suggest.execute());
  }
}
