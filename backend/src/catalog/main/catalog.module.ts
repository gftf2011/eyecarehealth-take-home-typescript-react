import type { Kysely } from 'kysely';

import type { Clock } from '../../shared-kernel/application';
import type { Route } from '../../shared-kernel/presentation';
import { CreateProductUseCase } from '../application/usecases/create-product/create-product.usecase';
import { GetProductUseCase } from '../application/usecases/get-product/get-product.usecase';
import { ListProductsUseCase } from '../application/usecases/list-products/list-products.usecase';
import { RemoveProductUseCase } from '../application/usecases/remove-product/remove-product.usecase';
import { UpdateProductUseCase } from '../application/usecases/update-product/update-product.usecase';
import type { CatalogDatabase } from '../infra/persistence/schema/catalog-database';
import { KyselyCatalogUnitOfWork } from '../infra/persistence/unit-of-work/kysely-catalog-unit-of-work';
import { CreateProductController } from '../presentation/controllers/create-product.controller';
import { GetProductController } from '../presentation/controllers/get-product.controller';
import { ListProductsController } from '../presentation/controllers/list-products.controller';
import { RemoveProductController } from '../presentation/controllers/remove-product.controller';
import { UpdateProductController } from '../presentation/controllers/update-product.controller';
import { createProductRoute } from '../presentation/routes/create-product.route';
import { getProductRoute } from '../presentation/routes/get-product.route';
import { listProductsRoute } from '../presentation/routes/list-products.route';
import { removeProductRoute } from '../presentation/routes/remove-product.route';
import { updateProductRoute } from '../presentation/routes/update-product.route';

export type CatalogModuleDependencies = {
  readonly db: Kysely<CatalogDatabase>;
  readonly clock: Clock;
};

/**
 * Composition root do Catalog: o único lugar onde as camadas do contexto se
 * encontram. Liga infra → casos de uso → controllers → rotas.
 */
export function makeCatalogRoutes({ db, clock }: CatalogModuleDependencies): Route[] {
  const unitOfWork = new KyselyCatalogUnitOfWork(db);

  return [
    listProductsRoute(new ListProductsController(new ListProductsUseCase(unitOfWork))),
    getProductRoute(new GetProductController(new GetProductUseCase(unitOfWork))),
    createProductRoute(new CreateProductController(new CreateProductUseCase(unitOfWork, clock))),
    updateProductRoute(new UpdateProductController(new UpdateProductUseCase(unitOfWork, clock))),
    removeProductRoute(new RemoveProductController(new RemoveProductUseCase(unitOfWork, clock))),
  ];
}
