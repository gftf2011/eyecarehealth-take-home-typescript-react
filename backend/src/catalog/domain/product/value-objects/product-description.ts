import { ValueObject } from '../../../../shared-kernel/domain/index.js';
import { InvalidProductDescriptionError } from '../errors/index.js';

const MIN_LENGTH = 10;
const MAX_LENGTH = 500;

export class ProductDescription extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): ProductDescription {
    const value = raw.trim();
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      throw new InvalidProductDescriptionError(
        `A descrição deve ter entre ${MIN_LENGTH} e ${MAX_LENGTH} caracteres`,
      );
    }
    return new ProductDescription(value);
  }

  get value(): string {
    return this.props.value;
  }
}
