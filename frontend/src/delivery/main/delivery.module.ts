import type { FetchHttpClient } from '../../shared-kernel/infra';
import { AcceptAssignmentUseCase, LoadDispatchBoardUseCase, SuggestAssignmentUseCase } from '../application';
import { HttpAssignmentGateway, HttpDispatchBoardGateway } from '../infra';
import type { DeliveryServices } from '../presentation';

export type DeliveryModule = {
  readonly services: DeliveryServices;
};

/** Composition root do Delivery: recebe o cliente HTTP autenticado do painel. */
export function createDeliveryModule(api: FetchHttpClient): DeliveryModule {
  const assignments = new HttpAssignmentGateway(api);
  return {
    services: {
      loadDispatchBoard: new LoadDispatchBoardUseCase(new HttpDispatchBoardGateway(api)),
      suggestAssignment: new SuggestAssignmentUseCase(assignments),
      acceptAssignment: new AcceptAssignmentUseCase(assignments),
    },
  };
}
