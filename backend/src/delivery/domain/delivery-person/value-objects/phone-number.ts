import { ValueObject } from '../../../../shared-kernel/domain/index';
import { InvalidPhoneNumberError } from '../errors/index';

const BRAZILIAN_MOBILE_PATTERN = /^\(\d{2}\) \d{5}-\d{4}$/;

/**
 * Telefone no formato brasileiro `(XX) XXXXX-XXXX`. Duplicado de propósito em
 * relação ao Ordering: cada contexto evolui a própria regra sem acoplamento.
 */
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
