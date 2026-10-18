import { collectFieldErrors, validateInput } from '../../../shared-kernel/application';
import { Email, Password } from '../../domain';

export type LoginInput = {
  readonly email: string;
  readonly password: string;
};

export type LoginField = keyof LoginInput;

/** Valida email e senha juntos; lança um único `InputValidationError` com os dois campos. */
export function parseLoginInput(input: LoginInput): { email: Email; password: Password } {
  return validateInput({
    email: () => Email.create(input.email),
    password: () => Password.create(input.password),
  });
}

/** Mensagens por campo para a validação em tempo real do formulário. */
export function loginInputErrors(input: LoginInput): Partial<Record<LoginField, string>> {
  return collectFieldErrors(() => parseLoginInput(input));
}
