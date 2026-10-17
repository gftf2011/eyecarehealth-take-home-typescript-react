import { InvalidValueError } from '../../../shared-kernel/domain';

/**
 * Senha fora da política. O teto vem do bcrypt, que ignora tudo depois de 72
 * bytes: senhas maiores dariam a falsa impressão de serem mais fortes.
 */
export class InvalidPasswordError extends InvalidValueError {
  readonly code = 'INVALID_PASSWORD';

  constructor(minLength: number, maxBytes: number) {
    super('password', `A senha deve ter pelo menos ${minLength} caracteres e no máximo ${maxBytes} bytes`);
  }
}
