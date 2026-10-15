import { describe, expect, it } from 'vitest';

import { Money } from '../../domain/index';
import { InputValidationError } from '../errors/input-validation.error';
import { validateInput } from './validate-input';

describe('validateInput', () => {
  it('devolve os valores construídos quando tudo é válido', () => {
    const { price, quantity } = validateInput({
      price: () => Money.fromDecimal(10.5),
      quantity: () => 3,
    });

    expect(price.cents).toBe(1050);
    expect(quantity).toBe(3);
  });

  it('agrupa todos os campos inválidos em um único VALIDATION_ERROR', () => {
    const attempt = (): unknown =>
      validateInput({
        price: () => Money.fromDecimal(1.234, 'price'),
        valid: () => 'ok',
        discount: () => Money.fromDecimal(-1, 'discount'),
      });

    expect(attempt).toThrow(InputValidationError);
    expect(attempt).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'price', message: 'O valor deve ter no máximo 2 casas decimais' },
          { field: 'discount', message: 'O valor não pode ser negativo' },
        ],
      }),
    );
  });

  it('relança erros que não são de validação', () => {
    const bug = new TypeError('bug');

    expect(() =>
      validateInput({
        broken: () => {
          throw bug;
        },
      }),
    ).toThrow(bug);
  });
});
