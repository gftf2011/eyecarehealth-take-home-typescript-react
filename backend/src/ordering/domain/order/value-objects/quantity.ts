import { ValueObject } from '../../../../shared-kernel/domain/index.js';
import { InvalidQuantityError } from '../errors/index.js';

/** Teto imposto pela coluna INTEGER (int4) do PostgreSQL. */
const MAX_QUANTITY = 2_147_483_647;

/** Quantidade de um item no pedido: inteiro positivo. */
export class Quantity extends ValueObject<{ value: number }> {
  private constructor(value: number) {
    super({ value });
  }

  static of(value: number): Quantity {
    if (!Number.isInteger(value) || value < 1 || value > MAX_QUANTITY) {
      throw new InvalidQuantityError('A quantidade deve ser um inteiro maior que zero');
    }
    return new Quantity(value);
  }

  get value(): number {
    return this.props.value;
  }

  add(other: Quantity): Quantity {
    return Quantity.of(this.props.value + other.value);
  }
}
