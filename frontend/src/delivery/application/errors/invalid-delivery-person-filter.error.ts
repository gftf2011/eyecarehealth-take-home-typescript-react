import { InvalidValueError } from '../../../shared-kernel/domain';

/** Filtro da listagem de entregadores fora das regras da API. */
export class InvalidDeliveryPersonFilterError extends InvalidValueError {
  readonly code = 'INVALID_DELIVERY_PERSON_FILTER';

  constructor(field: string, message: string) {
    super(field, message);
  }
}
