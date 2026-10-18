import { InputValidationError } from '../errors/input-validation.error';

/**
 * Roda uma validação de entrada e devolve as mensagens por campo (vazio se
 * tudo for válido). É o que os formulários usam para validar em tempo real
 * com as mesmas regras do caso de uso.
 */
export function collectFieldErrors(validate: () => unknown): Readonly<Record<string, string>> {
  try {
    validate();
    return {};
  } catch (error) {
    if (error instanceof InputValidationError) return error.messagesByField();
    throw error;
  }
}
