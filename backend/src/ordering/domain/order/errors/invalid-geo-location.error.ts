import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidGeoLocationError extends InvalidValueError {
  readonly code = 'INVALID_GEO_LOCATION';

  constructor(field: 'latitude' | 'longitude', message: string) {
    super(field, message);
  }
}
