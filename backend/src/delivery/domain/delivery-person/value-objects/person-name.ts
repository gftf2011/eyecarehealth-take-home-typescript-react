import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidPersonNameError } from '../errors';

const MIN_LENGTH = 3;
const MAX_LENGTH = 100;

export class PersonName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): PersonName {
    const value = raw.trim();
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      throw new InvalidPersonNameError(
        `O nome deve ter entre ${MIN_LENGTH} e ${MAX_LENGTH} caracteres`,
      );
    }
    return new PersonName(value);
  }

  get value(): string {
    return this.props.value;
  }
}
