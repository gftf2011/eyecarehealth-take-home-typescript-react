import { InvalidValueError } from '../../../../shared-kernel/domain/index';

export class InvalidImageUrlError extends InvalidValueError {
  readonly code = 'INVALID_IMAGE_URL';

  constructor(message: string) {
    super('imageUrl', message);
  }
}
