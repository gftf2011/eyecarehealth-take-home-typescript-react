import { InvalidValueError } from '../../../../shared-kernel/domain';

export class InvalidImageUrlError extends InvalidValueError {
  readonly code = 'INVALID_IMAGE_URL';

  constructor(message: string) {
    super('imageUrl', message);
  }
}
