import type { FetchHttpClient } from '../../shared-kernel/infra';
import {
  CreateProductUseCase,
  ListProductsUseCase,
  RemoveProductUseCase,
  SetProductAvailabilityUseCase,
  UpdateProductUseCase,
} from '../application';
import { HttpProductGateway } from '../infra';
import type { CatalogServices } from '../presentation';

export type CatalogModule = {
  readonly services: CatalogServices;
};

/** Composition root do Catalog: recebe o cliente HTTP autenticado do painel. */
export function createCatalogModule(api: FetchHttpClient): CatalogModule {
  const products = new HttpProductGateway(api);
  return {
    services: {
      listProducts: new ListProductsUseCase(products),
      createProduct: new CreateProductUseCase(products),
      updateProduct: new UpdateProductUseCase(products),
      setProductAvailability: new SetProductAvailabilityUseCase(products),
      removeProduct: new RemoveProductUseCase(products),
    },
  };
}
