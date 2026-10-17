import type { Kysely } from 'kysely';

import type { Route } from '../../shared-kernel/presentation';
import { GetDeliveryTimeReportUseCase } from '../application/usecases/get-delivery-time-report/get-delivery-time-report.usecase';
import { GetOrdersByStatusReportUseCase } from '../application/usecases/get-orders-by-status-report/get-orders-by-status-report.usecase';
import { GetRevenueReportUseCase } from '../application/usecases/get-revenue-report/get-revenue-report.usecase';
import { GetTopProductsReportUseCase } from '../application/usecases/get-top-products-report/get-top-products-report.usecase';
import { KyselyDeliveryTimeQuery } from '../infra/persistence/queries/kysely-delivery-time.query';
import { KyselyOrdersByStatusQuery } from '../infra/persistence/queries/kysely-orders-by-status.query';
import { KyselyRevenueQuery } from '../infra/persistence/queries/kysely-revenue.query';
import { KyselyTopProductsQuery } from '../infra/persistence/queries/kysely-top-products.query';
import type { ReportingDatabase } from '../infra/persistence/schema/reporting-database';
import { GetDeliveryTimeReportController } from '../presentation/controllers/get-delivery-time-report.controller';
import { GetOrdersByStatusReportController } from '../presentation/controllers/get-orders-by-status-report.controller';
import { GetRevenueReportController } from '../presentation/controllers/get-revenue-report.controller';
import { GetTopProductsReportController } from '../presentation/controllers/get-top-products-report.controller';
import { getDeliveryTimeReportRoute } from '../presentation/routes/get-delivery-time-report.route';
import { getOrdersByStatusReportRoute } from '../presentation/routes/get-orders-by-status-report.route';
import { getRevenueReportRoute } from '../presentation/routes/get-revenue-report.route';
import { getTopProductsReportRoute } from '../presentation/routes/get-top-products-report.route';

export type ReportingModuleDependencies = {
  readonly db: Kysely<ReportingDatabase>;
};

/**
 * Composition root do Reporting. Só leitura: sem unit of work nem eventos —
 * cada relatório é uma consulta agregada sobre os dados dos outros contextos.
 */
export function makeReportingRoutes({ db }: ReportingModuleDependencies): Route[] {
  return [
    getRevenueReportRoute(
      new GetRevenueReportController(new GetRevenueReportUseCase(new KyselyRevenueQuery(db))),
    ),
    getOrdersByStatusReportRoute(
      new GetOrdersByStatusReportController(
        new GetOrdersByStatusReportUseCase(new KyselyOrdersByStatusQuery(db)),
      ),
    ),
    getTopProductsReportRoute(
      new GetTopProductsReportController(new GetTopProductsReportUseCase(new KyselyTopProductsQuery(db))),
    ),
    getDeliveryTimeReportRoute(
      new GetDeliveryTimeReportController(
        new GetDeliveryTimeReportUseCase(new KyselyDeliveryTimeQuery(db)),
      ),
    ),
  ];
}
