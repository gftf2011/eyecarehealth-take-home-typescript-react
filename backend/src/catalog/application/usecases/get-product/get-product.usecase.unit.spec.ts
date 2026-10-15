import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application/index.js';
import { ProductNotFoundError } from '../../../domain/index.js';
import { BURGER_DTO, productDto } from '../../testing/product-dto.fixture.js';
import { StubProductQuery } from '../../testing/stub-product.query.js';
import { GetProductUseCase } from './get-product.usecase.js';

const PUDDING = productDto({
  id: '7a1c9e2b-4d3f-4a6b-8c9d-1e2f3a4b5c6d',
  name: 'Pudim de Leite',
  isAvailable: false,
});

describe('GetProductUseCase', () => {
  let query: StubProductQuery;
  let getProduct: GetProductUseCase;

  beforeEach(() => {
    query = new StubProductQuery();
    query.givenProducts(BURGER_DTO, PUDDING);
    getProduct = new GetProductUseCase(query);
  });

  it('devolve o produto pelo ID', async () => {
    await expect(getProduct.execute({ id: BURGER_DTO.id })).resolves.toEqual(BURGER_DTO);
  });

  it('aceita o ID em maiúsculas', async () => {
    await expect(getProduct.execute({ id: BURGER_DTO.id.toUpperCase() })).resolves.toEqual(
      BURGER_DTO,
    );
  });

  it('no backoffice, mostra produto indisponível', async () => {
    await expect(getProduct.execute({ id: PUDDING.id })).resolves.toEqual(PUDDING);
  });

  it('na visão pública, produto indisponível é PRODUCT_NOT_FOUND', async () => {
    await expect(getProduct.execute({ id: PUDDING.id, visibility: 'public' })).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });

  it('lança PRODUCT_NOT_FOUND para ID inexistente', async () => {
    await expect(
      getProduct.execute({ id: '00000000-0000-4000-8000-000000000000' }),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it('rejeita ID malformado', async () => {
    await expect(getProduct.execute({ id: '123' })).rejects.toBeInstanceOf(InputValidationError);
  });
});
