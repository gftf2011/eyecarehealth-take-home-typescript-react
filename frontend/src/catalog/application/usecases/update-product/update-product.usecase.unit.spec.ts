import { describe, expect, it } from 'vitest';

import { toProductDto } from '../../dtos/product.dto';
import { productFormInputFrom } from '../../inputs/product-form.input';
import { FakeProductGateway } from '../../testing/fake-product.gateway';
import { buildProduct } from '../../../domain/product/testing/product.fixture';
import { UpdateProductUseCase } from './update-product.usecase';

describe('UpdateProductUseCase', () => {
  it('salva o formulário; imagem em branco remove a imagem', async () => {
    const gateway = new FakeProductGateway();
    const form = productFormInputFrom(toProductDto(buildProduct()));

    const product = await new UpdateProductUseCase(gateway).execute({
      ...form,
      id: 'product-1',
      price: '35,00',
      imageUrl: '  ',
    });

    const changes = gateway.updates[0]?.changes;
    expect(changes?.price?.amount.cents).toBe(3500);
    expect(changes?.imageUrl).toBeNull();
    expect(product.priceCents).toBe(3500);
  });
});
