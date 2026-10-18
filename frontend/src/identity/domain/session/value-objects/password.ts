import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidPasswordError } from '../errors';

/**
 * Senha digitada no login. Não é normalizada (espaços contam) e a política de
 * força não se aplica aqui: como na API, o login só exige que ela exista, e
 * quem decide se ela confere é o servidor.
 */
export class Password extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): Password {
    if (raw === '') throw new InvalidPasswordError('Informe a senha');
    return new Password(raw);
  }

  get value(): string {
    return this.props.value;
  }
}
