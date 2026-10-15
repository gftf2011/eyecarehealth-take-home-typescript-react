import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application/index';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { ProductCreated } from '../../../domain/index';
import { InMemoryCatalogUnitOfWork } from '../../testing/in-memory-catalog-unit-of-work';
import { CreateProductUseCase, type CreateProductInput } from './create-product.usecase';

const NOW = new Date('2025-01-15T10:30:00Z');

const validInput: CreateProductInput = {
  name: 'Suco de Laranja Natural',
  description: 'Suco de laranja natural, feito na hora, 500ml',
  price: 12.5,
  category: 'drink',
  imageUrl: 'https://example.com/suco.jpg',
  preparationTime: 5,
};

describe('CreateProductUseCase', () => {
  let unitOfWork: InMemoryCatalogUnitOfWork;
  let createProduct: CreateProductUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryCatalogUnitOfWork();
    createProduct = new CreateProductUseCase(unitOfWork, new FixedClock(NOW));
  });

  it('cadastra o produto e devolve o DTO de saída', async () => {
    const product = await createProduct.execute(validInput);

    expect(product).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Suco de Laranja Natural',
      description: 'Suco de laranja natural, feito na hora, 500ml',
      price: 12.5,
      category: 'drink',
      imageUrl: 'https://example.com/suco.jpg',
      isAvailable: true,
      preparationTime: 5,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(unitOfWork.products.has(product.id)).toBe(true);
  });

  it('grava o evento ProductCreated no outbox na mesma transação', async () => {
    const product = await createProduct.execute(validInput);

    expect(unitOfWork.commits).toBe(1);
    expect(unitOfWork.outbox).toHaveLength(1);
    expect(unitOfWork.outbox[0]).toBeInstanceOf(ProductCreated);
    expect(unitOfWork.outbox[0]?.aggregateId).toBe(product.id);
  });

  it('respeita isAvailable = false', async () => {
    const product = await createProduct.execute({ ...validInput, isAvailable: false });
    expect(product.isAvailable).toBe(false);
  });

  it.each([undefined, null, '', '   '])('trata imageUrl %j como produto sem imagem', async (imageUrl) => {
    const product = await createProduct.execute({ ...validInput, imageUrl });
    expect(product.imageUrl).toBeNull();
  });

  it('rejeita entrada inválida listando todos os campos, sem abrir transação', async () => {
    const attempt = createProduct.execute({
      ...validInput,
      name: 'ab',
      price: 0,
      category: 'pizza',
      imageUrl: 'not-a-url',
    });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [
        { field: 'name', message: 'O nome deve ter entre 3 e 120 caracteres' },
        { field: 'price', message: 'O preço deve ser maior que zero' },
        { field: 'category', message: 'A categoria deve ser uma de: meal, drink, dessert, side' },
        { field: 'imageUrl', message: 'A URL da imagem deve ser uma URL http(s) válida' },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
    expect(unitOfWork.products.size).toBe(0);
  });

  it('é atômico: se o commit falhar, nem o produto nem o evento são gravados', async () => {
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(createProduct.execute(validInput)).rejects.toBe(databaseDown);

    expect(unitOfWork.rollbacks).toBe(1);
    expect(unitOfWork.products.size).toBe(0);
    expect(unitOfWork.outbox).toHaveLength(0);
  });
});
