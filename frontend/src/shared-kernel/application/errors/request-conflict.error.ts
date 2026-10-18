import { ConflictError } from '../../domain';

/** `409`: a operação conflita com o estado atual (ex.: produto em pedido aberto). */
export class RequestConflictError extends ConflictError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
