import { describe, expect, it } from 'vitest';

import { parseProductFormInput } from '../../application';
import { productBody } from '../../domain/product/testing/product.fixture';
import { productSchema, toProduct, toProductRequestBody } from './product.mapper';

describe('product.mapper', () => {
  it('corpo da API → agregado (reais → centavos)', () => {
    const product = toProduct(productSchema.parse(productBody({ price: 0.1, imageUrl: 'https://x.com/a.png' })));

    expect(product.price.amount.cents).toBe(10);
    expect(product.imageUrl?.value).toBe('https://x.com/a.png');
  });

  it('detalhes → corpo da requisição em reais, com imagem nula explícita', () => {
    const details = parseProductFormInput({
      name: 'Batata Frita',
      description: 'Porção de batata frita crocante',
      price: '16,5',
      category: 'side',
      imageUrl: '',
      preparationTime: '10',
      isAvailable: true,
    });

    expect(toProductRequestBody(details)).toEqual({
      name: 'Batata Frita',
      description: 'Porção de batata frita crocante',
      price: 16.5,
      category: 'side',
      imageUrl: null,
      preparationTime: 10,
      isAvailable: true,
    });
  });

  it('atualização parcial envia só o que mudou', () => {
    expect(toProductRequestBody({ isAvailable: false })).toEqual({ isAvailable: false });
  });
});
