import { describe, expect, it } from 'vitest';

import { InputValidationError, type Page } from '../../../shared-kernel/application';
import { httpRequest } from '../../../shared-kernel/presentation/testing/http-request';
import { SpyUseCase } from '../../../shared-kernel/presentation/testing/spy-use-case';
import type { ProductDto } from '../../application/dtos/product.dto';
import type { ListProductsInput } from '../../application/usecases/list-products/list-products.usecase';
import { ListProductsController } from './list-products.controller';

const EMPTY_PAGE: Page<ProductDto> = {
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

function request(query: unknown) {
  return httpRequest({ query });
}

describe('ListProductsController', () => {
  it('converte a query string e lista na visão do painel', async () => {
    const useCase = new SpyUseCase<ListProductsInput, Page<ProductDto>>(EMPTY_PAGE);
    const controller = new ListProductsController(useCase);

    const response = await controller.handle(
      request({ page: '2', limit: '10', isAvailable: 'false', search: 'burger', sortBy: 'price' }),
    );

    expect(response).toEqual({ status: 200, body: EMPTY_PAGE });
    expect(useCase.inputs).toEqual([
      {
        page: 2,
        limit: 10,
        isAvailable: false,
        search: 'burger',
        sortBy: 'price',
        visibility: 'backoffice',
      },
    ]);
  });

  it('rejeita query com tipo errado antes de chamar o caso de uso', async () => {
    const useCase = new SpyUseCase<ListProductsInput, Page<ProductDto>>(EMPTY_PAGE);

    await expect(
      new ListProductsController(useCase).handle(request({ page: 'abc', isAvailable: 'sim' })),
    ).rejects.toBeInstanceOf(InputValidationError);
    expect(useCase.inputs).toHaveLength(0);
  });
});
