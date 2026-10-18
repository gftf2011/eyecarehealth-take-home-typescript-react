import { NotFoundError } from '../../domain';

/** `404`: o recurso não existe ou foi removido. */
export class ResourceNotFoundError extends NotFoundError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
