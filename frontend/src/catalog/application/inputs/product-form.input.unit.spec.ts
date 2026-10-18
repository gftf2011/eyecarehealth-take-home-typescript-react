import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../shared-kernel/application';
import { toProductDto } from '../dtos/product.dto';
import { buildProduct } from '../../domain/product/testing/product.fixture';
import {
  EMPTY_PRODUCT_FORM,
  parseProductFormInput,
  productFormErrors,
  productFormInputFrom,
  type ProductFormInput,
} from './product-form.input';

const VALID: ProductFormInput = {
  name: 'Suco de Laranja',
  description: 'Suco natural de laranja, 500ml',
  price: '12,50',
  category: 'drink',
  imageUrl: '',
  preparationTime: '5',
  isAvailable: true,
};

describe('product-form.input', () => {
  it('converte o formulário em detalhes validados (preço com vírgula, sem imagem)', () => {
    const details = parseProductFormInput(VALID);

    expect(details.price.amount.cents).toBe(1250);
    expect(details.category.value).toBe('drink');
    expect(details.imageUrl).toBeNull();
    expect(details.preparationTime.minutes).toBe(5);
  });

  it.each([
    ['32.9', 3290],
    ['32,90', 3290],
    ['R$ 7', 700],
    [' 1000 ', 100000],
  ])('preço %j vira %i centavos', (price, cents) => {
    expect(parseProductFormInput({ ...VALID, price }).price.amount.cents).toBe(cents);
  });

  it('formulário vazio: uma mensagem clara por campo obrigatório', () => {
    expect(productFormErrors(EMPTY_PRODUCT_FORM)).toEqual({
      name: 'O nome deve ter entre 3 e 120 caracteres',
      description: 'A descrição deve ter entre 10 e 500 caracteres',
      price: 'Informe o preço',
      category: 'Escolha uma categoria',
      preparationTime: 'Informe o tempo de preparo',
    });
  });

  it.each([
    [{ price: '0' }, 'price', 'O preço deve ser maior que zero'],
    [{ price: '12,345' }, 'price', 'O preço deve ter no máximo 2 casas decimais'],
    [{ price: 'doze' }, 'price', 'Informe um preço válido, como 32,90'],
    [{ preparationTime: '121' }, 'preparationTime', 'O tempo de preparo deve ser um inteiro entre 1 e 120 minutos'],
    [{ preparationTime: '2.5' }, 'preparationTime', 'O tempo de preparo deve ser um inteiro entre 1 e 120 minutos'],
    [{ imageUrl: 'ftp://x/y.png' }, 'imageUrl', 'A URL da imagem deve ser uma URL http(s) válida'],
  ] as const)('%j → %s: %s', (patch, field, message) => {
    expect(productFormErrors({ ...VALID, ...patch })[field]).toBe(message);
    expect(() => parseProductFormInput({ ...VALID, ...patch })).toThrow(InputValidationError);
  });

  it('preenche a edição no formato brasileiro e volta igual', () => {
    const input = productFormInputFrom(toProductDto(buildProduct({ price: 32.9 })));

    expect(input.price).toBe('32,90');
    expect(parseProductFormInput(input).price.amount.cents).toBe(3290);
  });
});
