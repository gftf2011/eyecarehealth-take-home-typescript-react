import { ValueObject } from '../../../../shared-kernel/domain/index.js';
import { InvalidDeliveryAddressError } from '../errors/index.js';

const MIN_LENGTH = 10;
const MAX_LENGTH = 300;

export class DeliveryAddress extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): DeliveryAddress {
    const value = raw.trim();
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      throw new InvalidDeliveryAddressError(
        `O endereço de entrega deve ter entre ${MIN_LENGTH} e ${MAX_LENGTH} caracteres`,
      );
    }
    return new DeliveryAddress(value);
  }

  get value(): string {
    return this.props.value;
  }
}
