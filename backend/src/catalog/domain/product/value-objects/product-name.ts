import { ValueObject } from '../../../../shared-kernel/domain/index';
import { InvalidProductNameError } from '../errors/index';

const MIN_LENGTH = 3;
const MAX_LENGTH = 120;

export class ProductName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): ProductName {
    const value = raw.trim();
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      throw new InvalidProductNameError(
        `O nome deve ter entre ${MIN_LENGTH} e ${MAX_LENGTH} caracteres`,
      );
    }
    return new ProductName(value);
  }

  get value(): string {
    return this.props.value;
  }
}
