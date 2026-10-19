import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidDeliveryIssueNoteError } from '../errors';

/** Cabe no motivo do histórico (200) junto com o prefixo, quando o pedido é cancelado. */
const MAX_LENGTH = 150;

/** O que o entregador escreveu sobre o problema (opcional, exceto no motivo `other`). */
export class DeliveryIssueNote extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  /** Texto em branco vira `null` (sem observação). */
  static createOptional(raw: string | null | undefined): DeliveryIssueNote | null {
    const value = raw?.trim() ?? '';
    if (value === '') return null;
    if (value.length > MAX_LENGTH) {
      throw new InvalidDeliveryIssueNoteError(`A observação deve ter no máximo ${MAX_LENGTH} caracteres`);
    }
    return new DeliveryIssueNote(value);
  }

  get value(): string {
    return this.props.value;
  }
}
