import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { EMPTY_PRODUCT_FORM } from '../../inputs/product-form.input';
import { FakeProductGateway } from '../../testing/fake-product.gateway';
import { CreateProductUseCase } from './create-product.usecase';

describe('CreateProductUseCase', () => {
  it('envia os detalhes validados e devolve o produto criado', async () => {
    const gateway = new FakeProductGateway();

    const product = await new CreateProductUseCase(gateway).execute({
      name: 'Brownie',
      description: 'Brownie de chocolate meio amargo',
      price: '14,00',
      category: 'dessert',
      imageUrl: 'https://cdn.fastmeals.com/brownie.jpg',
      preparationTime: '3',
      isAvailable: false,
    });

    expect(gateway.created[0]?.price.amount.cents).toBe(1400);
    expect(product).toMatchObject({
      id: 'product-new',
      name: 'Brownie',
      priceCents: 1400,
      category: 'dessert',
      imageUrl: 'https://cdn.fastmeals.com/brownie.jpg',
      isAvailable: false,
    });
  });

  it('formulário inválido não chega à API', async () => {
    const gateway = new FakeProductGateway();

    await expect(new CreateProductUseCase(gateway).execute(EMPTY_PRODUCT_FORM)).rejects.toThrow(InputValidationError);
    expect(gateway.created).toHaveLength(0);
  });
});
