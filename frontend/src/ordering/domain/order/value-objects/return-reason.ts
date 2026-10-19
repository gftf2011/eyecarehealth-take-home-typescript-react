import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidReturnReasonError } from '../errors';

const MIN_LENGTH = 3;
const MAX_LENGTH = 200;

/** Por que a entrega voltou para a atribuição (mesma regra da API; fica no histórico). */
export class ReturnReason extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): ReturnReason {
    const value = raw.trim();
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      throw new InvalidReturnReasonError(`O motivo deve ter entre ${MIN_LENGTH} e ${MAX_LENGTH} caracteres`);
    }
    return new ReturnReason(value);
  }

  get value(): string {
    return this.props.value;
  }
}
