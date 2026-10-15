import { InvalidValueError } from '../../../../shared-kernel/domain';

export class InvalidGeoPointError extends InvalidValueError {
  readonly code = 'INVALID_GEO_POINT';

  constructor(field: string, message: string) {
    super(field, message);
  }
}
