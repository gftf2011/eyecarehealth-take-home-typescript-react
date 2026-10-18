import { InvalidMoneyError } from './errors/invalid-money.error';
import { ValueObject } from './value-object';

const CENTS_PER_UNIT = 100;
const DECIMAL_TOLERANCE = 1e-6;

/**
 * Valor monetário (BRL) guardado em centavos inteiros, evitando erros de ponto
 * flutuante nas somas (ex.: 0.1 + 0.2). Nunca é negativo.
 */
export class Money extends ValueObject<{ cents: number }> {
  private constructor(cents: number) {
    super({ cents });
  }

  static zero(): Money {
    return new Money(0);
  }

  static fromCents(cents: number, field = 'amount'): Money {
    if (!Number.isSafeInteger(cents)) {
      throw new InvalidMoneyError(field, 'O valor em centavos deve ser um inteiro');
    }
    if (cents < 0) throw new InvalidMoneyError(field, 'O valor não pode ser negativo');
    return new Money(cents);
  }

  static fromDecimal(amount: number, field = 'amount'): Money {
    if (!Number.isFinite(amount)) throw new InvalidMoneyError(field, 'O valor deve ser um número');
    if (!Money.hasAtMostTwoDecimals(amount)) {
      throw new InvalidMoneyError(field, 'O valor deve ter no máximo 2 casas decimais');
    }
    return Money.fromCents(Math.round(amount * CENTS_PER_UNIT), field);
  }

  static hasAtMostTwoDecimals(amount: number): boolean {
    const scaled = amount * CENTS_PER_UNIT;
    return Math.abs(scaled - Math.round(scaled)) < DECIMAL_TOLERANCE;
  }

  get cents(): number {
    return this.props.cents;
  }

  toDecimal(): number {
    return this.props.cents / CENTS_PER_UNIT;
  }

  isZero(): boolean {
    return this.props.cents === 0;
  }

  isPositive(): boolean {
    return this.props.cents > 0;
  }

  add(other: Money): Money {
    return Money.fromCents(this.props.cents + other.cents);
  }

  multiply(quantity: number): Money {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new InvalidMoneyError('quantity', 'A quantidade deve ser um inteiro não negativo');
    }
    return Money.fromCents(this.props.cents * quantity);
  }

  isGreaterThan(other: Money): boolean {
    return this.props.cents > other.cents;
  }
}
