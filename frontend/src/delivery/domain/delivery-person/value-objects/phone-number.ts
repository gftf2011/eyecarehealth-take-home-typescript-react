import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidPhoneNumberError } from '../errors';

/** Mesma regra da API: celular brasileiro com DDD. */
const BRAZILIAN_MOBILE_PATTERN = /^\(\d{2}\) \d{5}-\d{4}$/;

export class PhoneNumber extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): PhoneNumber {
    const value = raw.trim();
    if (!BRAZILIAN_MOBILE_PATTERN.test(value)) {
      throw new InvalidPhoneNumberError('O telefone deve estar no formato (XX) XXXXX-XXXX');
    }
    return new PhoneNumber(value);
  }

  get value(): string {
    return this.props.value;
  }
}
