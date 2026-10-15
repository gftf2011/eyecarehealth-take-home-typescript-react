import { ValueObject } from '../../../../shared-kernel/domain/index';
import { InvalidEmailError } from '../errors/index';

const MAX_LENGTH = 255;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email normalizado (trim + minúsculas): é a chave de login do usuário. */
export class Email extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (value.length > MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
      throw new InvalidEmailError('Informe um email válido');
    }
    return new Email(value);
  }

  get value(): string {
    return this.props.value;
  }
}
