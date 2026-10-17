import { describe, expect, it } from 'vitest';

import { InvalidMoneyError, Money } from '.';

describe('Money', () => {
  it.each([
    [32.9, 3290],
    [0.1, 10],
    [12.5, 1250],
    [0, 0],
    [99_999_999.99, 9_999_999_999],
  ])('converte %d para %d centavos sem erro de ponto flutuante', (decimal, cents) => {
    expect(Money.fromDecimal(decimal).cents).toBe(cents);
  });

  it.each([12.345, 0.001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejeita %d (mais de 2 casas ou não finito)',
    (decimal) => {
      expect(() => Money.fromDecimal(decimal)).toThrow(InvalidMoneyError);
    },
  );

  it('rejeita valores negativos', () => {
    expect(() => Money.fromDecimal(-1)).toThrow(InvalidMoneyError);
    expect(() => Money.fromCents(-1)).toThrow(InvalidMoneyError);
  });

  it('rejeita centavos fracionários', () => {
    expect(() => Money.fromCents(10.5)).toThrow(InvalidMoneyError);
  });

  it('soma sem perder precisão (0.1 + 0.2 = 0.3)', () => {
    const total = Money.fromDecimal(0.1).add(Money.fromDecimal(0.2));
    expect(total.toDecimal()).toBe(0.3);
  });

  it('multiplica por quantidade inteira', () => {
    expect(Money.fromDecimal(32.9).multiply(3).toDecimal()).toBe(98.7);
    expect(() => Money.fromDecimal(1).multiply(1.5)).toThrow(InvalidMoneyError);
    expect(() => Money.fromDecimal(1).multiply(-1)).toThrow(InvalidMoneyError);
  });

  it('tem igualdade estrutural', () => {
    expect(Money.fromDecimal(10).equals(Money.fromCents(1000))).toBe(true);
    expect(Money.fromDecimal(10).equals(Money.fromCents(1001))).toBe(false);
  });

  it('expõe o campo inválido nos detalhes do erro', () => {
    try {
      Money.fromDecimal(1.234, 'price');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidMoneyError);
      expect((error as InvalidMoneyError).details).toEqual([
        { field: 'price', message: 'O valor deve ter no máximo 2 casas decimais' },
      ]);
    }
  });
});
