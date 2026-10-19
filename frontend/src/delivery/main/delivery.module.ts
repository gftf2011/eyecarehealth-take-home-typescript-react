import type { FetchHttpClient } from '../../shared-kernel/infra';
import {
  AcceptAssignmentUseCase,
  ListDeliveryPersonsUseCase,
  LoadDispatchBoardUseCase,
  RegisterDeliveryPersonUseCase,
  RemoveDeliveryPersonUseCase,
  SetDeliveryPersonActivationUseCase,
  SuggestAssignmentUseCase,
  UpdateDeliveryPersonUseCase,
} from '../application';
import { HttpAssignmentGateway, HttpDeliveryPersonGateway, HttpDispatchBoardGateway } from '../infra';
import type { DeliveryServices } from '../presentation';

export type DeliveryModule = {
  readonly services: DeliveryServices;
};

/** Composition root do Delivery: recebe o cliente HTTP autenticado do painel. */
export function createDeliveryModule(api: FetchHttpClient): DeliveryModule {
  const assignments = new HttpAssignmentGateway(api);
  const deliveryPersons = new HttpDeliveryPersonGateway(api);
  return {
    services: {
      loadDispatchBoard: new LoadDispatchBoardUseCase(new HttpDispatchBoardGateway(api)),
      suggestAssignment: new SuggestAssignmentUseCase(assignments),
      acceptAssignment: new AcceptAssignmentUseCase(assignments),
      listDeliveryPersons: new ListDeliveryPersonsUseCase(deliveryPersons),
      registerDeliveryPerson: new RegisterDeliveryPersonUseCase(deliveryPersons),
      updateDeliveryPerson: new UpdateDeliveryPersonUseCase(deliveryPersons),
      setDeliveryPersonActivation: new SetDeliveryPersonActivationUseCase(deliveryPersons),
      removeDeliveryPerson: new RemoveDeliveryPersonUseCase(deliveryPersons),
    },
  };
}
