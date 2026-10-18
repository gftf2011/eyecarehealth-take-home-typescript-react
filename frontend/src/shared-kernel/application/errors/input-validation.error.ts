import { DomainError, type DomainErrorDetail } from '../../domain';

/**
 * Entrada com um ou mais campos inválidos, detectada no navegador (Value
 * Objects) ou pela API (`400 VALIDATION_ERROR`). Agrupa todos os campos para
 * o formulário mostrar tudo de uma vez.
 */
export class InputValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(details: readonly DomainErrorDetail[], message = 'Dados inválidos') {
    super(message, details);
  }

  /** Primeira mensagem de cada campo (`items.1.quantity` → mensagem). */
  messagesByField(): Readonly<Record<string, string>> {
    const messages: Record<string, string> = {};
    for (const detail of this.details) {
      const { field, message } = detail;
      if (typeof field === 'string' && typeof message === 'string' && !(field in messages)) {
        messages[field] = message;
      }
    }
    return messages;
  }
}
