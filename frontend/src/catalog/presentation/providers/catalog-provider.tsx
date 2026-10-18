import { createContext, use, type ReactNode } from 'react';

import type { Page, UseCase } from '../../../shared-kernel/application';
import type {
  ListProductsInput,
  ProductDto,
  ProductFormInput,
  RemoveProductInput,
  RequestOptions,
  SetProductAvailabilityInput,
  UpdateProductInput,
} from '../../application';

/** Casos de uso que a tela de produtos usa. */
export type CatalogServices = {
  readonly listProducts: UseCase<ListProductsInput & RequestOptions, Page<ProductDto>>;
  readonly createProduct: UseCase<ProductFormInput, ProductDto>;
  readonly updateProduct: UseCase<UpdateProductInput, ProductDto>;
  readonly setProductAvailability: UseCase<SetProductAvailabilityInput, ProductDto>;
  readonly removeProduct: UseCase<RemoveProductInput, void>;
};

const CatalogContext = createContext<CatalogServices | null>(null);

export function CatalogProvider({
  services,
  children,
}: {
  readonly services: CatalogServices;
  readonly children: ReactNode;
}) {
  return <CatalogContext value={services}>{children}</CatalogContext>;
}

export function useCatalogServices(): CatalogServices {
  const services = use(CatalogContext);
  if (services === null) throw new Error('useCatalogServices precisa estar dentro de <CatalogProvider>');
  return services;
}
