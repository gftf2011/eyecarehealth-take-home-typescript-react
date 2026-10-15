import { ValueObject } from '../../../../shared-kernel/domain/index';
import { InvalidTopProductsLimitError } from '../errors/invalid-top-products-limit.error';

const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 1;
/** Mesmo teto das listagens paginadas da API. */
const MAX_LIMIT = 100;

/** Tamanho do ranking de mais vendidos (padrão: top 10). */
export class TopProductsLimit extends ValueObject<{ value: number }> {
  private constructor(value: number) {
    super({ value });
  }

  static default(): TopProductsLimit {
    return new TopProductsLimit(DEFAULT_LIMIT);
  }

  static of(value: number): TopProductsLimit {
    if (!Number.isInteger(value) || value < MIN_LIMIT || value > MAX_LIMIT) {
      throw new InvalidTopProductsLimitError(MIN_LIMIT, MAX_LIMIT);
    }
    return new TopProductsLimit(value);
  }

  get value(): number {
    return this.props.value;
  }
}
