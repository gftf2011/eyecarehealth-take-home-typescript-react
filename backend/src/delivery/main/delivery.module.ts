import type { Kysely } from 'kysely';

import type { Clock } from '../../shared-kernel/application';
import type { InMemoryEventMediator } from '../../shared-kernel/infra/events/in-memory-event-mediator';
import type { Route } from '../../shared-kernel/presentation';
import { ListDeliveryPersonsUseCase } from '../application/usecases/list-delivery-persons/list-delivery-persons.usecase';
import { RegisterDeliveryPersonUseCase } from '../application/usecases/register-delivery-person/register-delivery-person.usecase';
import { RemoveDeliveryPersonUseCase } from '../application/usecases/remove-delivery-person/remove-delivery-person.usecase';
import { SuggestAssignmentUseCase } from '../application/usecases/suggest-assignment/suggest-assignment.usecase';
import type { DispatchPlanner } from '../application/ports/dispatch-planner';
import { UpdateDeliveryPersonUseCase } from '../application/usecases/update-delivery-person/update-delivery-person.usecase';
import type { DeliveryDatabase } from '../infra/persistence/schema/delivery-database';
import { KyselyDeliveryUnitOfWork } from '../infra/persistence/unit-of-work/kysely-delivery-unit-of-work';
import { ListDeliveryPersonsController } from '../presentation/controllers/list-delivery-persons.controller';
import { RegisterDeliveryPersonController } from '../presentation/controllers/register-delivery-person.controller';
import { RemoveDeliveryPersonController } from '../presentation/controllers/remove-delivery-person.controller';
import { SuggestAssignmentController } from '../presentation/controllers/suggest-assignment.controller';
import { subscribeDeliveryEventHandlers } from './delivery-event-handlers';
import { UpdateDeliveryPersonController } from '../presentation/controllers/update-delivery-person.controller';
import { listDeliveryPersonsRoute } from '../presentation/routes/list-delivery-persons.route';
import { registerDeliveryPersonRoute } from '../presentation/routes/register-delivery-person.route';
import { removeDeliveryPersonRoute } from '../presentation/routes/remove-delivery-person.route';
import { suggestAssignmentRoute } from '../presentation/routes/suggest-assignment.route';
import { updateDeliveryPersonRoute } from '../presentation/routes/update-delivery-person.route';

export type DeliveryModuleDependencies = {
  readonly db: Kysely<DeliveryDatabase>;
  readonly clock: Clock;
  /**
   * Recebe os eventos de domínio do Delivery e os entrega aos handlers; o
   * Delivery também inscreve os próprios (ex.: atualizações para o painel).
   */
  readonly events: InMemoryEventMediator;
  /** Onde roda o otimizador de atribuição (ver `makeDispatchPlanner`). */
  readonly planner: DispatchPlanner;
};

/** Composition root do Delivery: liga infra → casos de uso → controllers → rotas. */
export function makeDeliveryRoutes({ db, clock, events, planner }: DeliveryModuleDependencies): Route[] {
  subscribeDeliveryEventHandlers(events);
  const unitOfWork = new KyselyDeliveryUnitOfWork(db, events);

  return [
    listDeliveryPersonsRoute(new ListDeliveryPersonsController(new ListDeliveryPersonsUseCase(unitOfWork))),
    registerDeliveryPersonRoute(
      new RegisterDeliveryPersonController(new RegisterDeliveryPersonUseCase(unitOfWork, clock)),
    ),
    updateDeliveryPersonRoute(
      new UpdateDeliveryPersonController(new UpdateDeliveryPersonUseCase(unitOfWork, clock)),
    ),
    removeDeliveryPersonRoute(
      new RemoveDeliveryPersonController(new RemoveDeliveryPersonUseCase(unitOfWork, clock)),
    ),
    suggestAssignmentRoute(
      new SuggestAssignmentController(
        new SuggestAssignmentUseCase(unitOfWork, planner),
      ),
    ),
  ];
}
