import { describe, expect, it } from 'vitest';

import { InvalidValueError, ValueObject } from '../../domain';
import { InputValidationError } from '../errors/input-validation.error';
import { collectFieldErrors } from './collect-field-errors';
import { validateInput } from './validate-input';

class InvalidQuantityError extends InvalidValueError {
  readonly code = 'INVALID_QUANTITY';

  constructor(field: string) {
    super(field, 'A quantidade deve ser maior que zero');
  }
}

class Quantity extends ValueObject<{ value: number }> {
  static of(value: number, field = 'quantity'): Quantity {
    if (!Number.isInteger(value) || value < 1) throw new InvalidQuantityError(field);
    return new Quantity({ value });
  }

  get value(): number {
    return this.props.value;
  }
}

describe('validateInput', () => {
  it('devolve os valores construídos quando tudo é válido', () => {
    const { quantity, note } = validateInput({ quantity: () => Quantity.of(2), note: () => 'ok' });

    expect(quantity.value).toBe(2);
    expect(note).toBe('ok');
  });

  it('agrupa todos os campos inválidos num único erro', () => {
    const attempt = (): unknown =>
      validateInput({ first: () => Quantity.of(0, 'items.0.quantity'), second: () => Quantity.of(-1, 'items.1.quantity') });

    expect(attempt).toThrow(InputValidationError);
    expect(attempt).toThrow(
      expect.objectContaining({
        details: [
          { field: 'items.0.quantity', message: 'A quantidade deve ser maior que zero' },
          { field: 'items.1.quantity', message: 'A quantidade deve ser maior que zero' },
        ],
      }),
    );
  });

  it('relança erros que não são de validação', () => {
    const bug = new TypeError('bug');
    const attempt = (): unknown =>
      validateInput({
        broken: () => {
          throw bug;
        },
      });

    expect(attempt).toThrow(bug);
  });
});

describe('collectFieldErrors', () => {
  it('mensagens por campo, ou vazio quando válido', () => {
    expect(collectFieldErrors(() => validateInput({ q: () => Quantity.of(0) }))).toEqual({
      quantity: 'A quantidade deve ser maior que zero',
    });
    expect(collectFieldErrors(() => validateInput({ q: () => Quantity.of(1) }))).toEqual({});
  });
});
