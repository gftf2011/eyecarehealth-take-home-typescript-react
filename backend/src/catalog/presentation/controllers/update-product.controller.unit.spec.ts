import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../shared-kernel/application';
import { ANONYMOUS_USER } from '../../../shared-kernel/presentation';
import { SpyUseCase } from '../../../shared-kernel/presentation/testing/spy-use-case';
import type { ProductDto } from '../../application/dtos/product.dto';
import type { UpdateProductInput } from '../../application/usecases/update-product/update-product.usecase';
import { UpdateProductController } from './update-product.controller';

const PRODUCT: ProductDto = {
  id: '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b',
  name: 'X-Burger Especial',
  description: 'Hamburguer artesanal com queijo cheddar e bacon',
  price: 35,
  category: 'meal',
  imageUrl: null,
  isAvailable: true,
  preparationTime: 25,
  createdAt: new Date('2025-01-15T10:30:00Z'),
  updatedAt: new Date('2025-01-16T10:30:00Z'),
};

function request(body: unknown) {
  return { params: { id: PRODUCT.id }, query: {}, body, user: ANONYMOUS_USER };
}

describe('UpdateProductController', () => {
  it('junta o ID da rota com os campos enviados, ignorando campos desconhecidos', async () => {
    const useCase = new SpyUseCase<UpdateProductInput, ProductDto>(PRODUCT);

    const response = await new UpdateProductController(useCase).handle(
      request({ price: 35, imageUrl: null, createdAt: '1999-01-01', id: 'outro' }),
    );

    expect(response).toEqual({ status: 200, body: PRODUCT });
    expect(useCase.inputs).toEqual([{ id: PRODUCT.id, price: 35, imageUrl: null }]);
  });

  it('rejeita preço enviado como texto sem chamar o caso de uso', async () => {
    const useCase = new SpyUseCase<UpdateProductInput, ProductDto>(PRODUCT);

    const attempt = new UpdateProductController(useCase).handle(request({ price: '35' }));

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [expect.objectContaining({ field: 'price' })],
    });
    expect(useCase.inputs).toHaveLength(0);
  });
});
