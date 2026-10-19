import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidReturnReasonError } from '../errors';

const MIN_LENGTH = 3;
const MAX_LENGTH = 200;

/**
 * Por que uma entrega em andamento voltou para a atribuição (ex.: "entregador
 * sem contato há 30 min"). Fica no histórico do pedido.
 */
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
