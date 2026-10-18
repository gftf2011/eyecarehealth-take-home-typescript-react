import { InvalidValueError } from '../../../shared-kernel/domain';

/** Busca ou filtro da listagem fora das regras da API. */
export class InvalidProductFilterError extends InvalidValueError {
  readonly code = 'INVALID_PRODUCT_FILTER';

  constructor(field: string, message: string) {
    super(field, message);
  }
}
