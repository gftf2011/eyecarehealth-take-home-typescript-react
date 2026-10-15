import { InvalidValueError } from '../../../../shared-kernel/domain/index';

export class InvalidDeliveryAddressError extends InvalidValueError {
  readonly code = 'INVALID_DELIVERY_ADDRESS';

  constructor(message: string) {
    super('deliveryAddress', message);
  }
}
