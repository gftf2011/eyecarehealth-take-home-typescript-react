import { ValueObject } from '../../../../shared-kernel/domain/index';
import { InvalidCustomerNameError } from '../errors/index';

const MIN_LENGTH = 3;
const MAX_LENGTH = 100;

export class CustomerName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): CustomerName {
    const value = raw.trim();
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      throw new InvalidCustomerNameError(
        `O nome do cliente deve ter entre ${MIN_LENGTH} e ${MAX_LENGTH} caracteres`,
      );
    }
    return new CustomerName(value);
  }

  get value(): string {
    return this.props.value;
  }
}
