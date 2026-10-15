import { Money, ValueObject } from '../../../../shared-kernel/domain';
import { InvalidProductPriceError } from '../errors';

/** Teto imposto pela coluna DECIMAL(10, 2). */
const MAX_PRICE_IN_CENTS = 9_999_999_999;

/** Preço de venda: sempre maior que zero e com no máximo 2 casas decimais. */
export class ProductPrice extends ValueObject<{ amount: Money }> {
  private constructor(amount: Money) {
    super({ amount });
  }

  static fromDecimal(raw: number): ProductPrice {
    if (!Number.isFinite(raw) || raw <= 0) {
      throw new InvalidProductPriceError('O preço deve ser maior que zero');
    }
    if (!Money.hasAtMostTwoDecimals(raw)) {
      throw new InvalidProductPriceError('O preço deve ter no máximo 2 casas decimais');
    }
    return ProductPrice.fromMoney(Money.fromDecimal(raw, 'price'));
  }

  static fromMoney(amount: Money): ProductPrice {
    if (!amount.isPositive()) throw new InvalidProductPriceError('O preço deve ser maior que zero');
    if (amount.cents > MAX_PRICE_IN_CENTS) {
      throw new InvalidProductPriceError('O preço excede o valor máximo permitido');
    }
    return new ProductPrice(amount);
  }

  get amount(): Money {
    return this.props.amount;
  }

  toDecimal(): number {
    return this.props.amount.toDecimal();
  }
}
