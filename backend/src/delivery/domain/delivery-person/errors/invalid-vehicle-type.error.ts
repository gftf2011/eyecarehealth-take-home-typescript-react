import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidVehicleTypeError extends InvalidValueError {
  readonly code = 'INVALID_VEHICLE_TYPE';

  constructor(message: string) {
    super('vehicleType', message);
  }
}
