import type { FetchHttpClient } from '../../shared-kernel/infra';
import {
  AcceptAssignmentUseCase,
  ConfirmMyDeliveryUseCase,
  ListDeliveryPersonsUseCase,
  LoadDispatchBoardUseCase,
  LoadMyDeliveriesUseCase,
  RegisterDeliveryPersonUseCase,
  RemoveDeliveryPersonUseCase,
  SetDeliveryPersonActivationUseCase,
  SuggestAssignmentUseCase,
  UpdateDeliveryPersonUseCase,
  UpdateMyLocationUseCase,
} from '../application';
import {
  HttpAssignmentGateway,
  HttpDeliveryPersonGateway,
  HttpDispatchBoardGateway,
  HttpMyDeliveriesGateway,
} from '../infra';
import type { DeliveryServices } from '../presentation';

export type DeliveryModule = {
  readonly services: DeliveryServices;
};

/** Composition root do Delivery: recebe o cliente HTTP autenticado do painel. */
export function createDeliveryModule(api: FetchHttpClient): DeliveryModule {
  const assignments = new HttpAssignmentGateway(api);
  const deliveryPersons = new HttpDeliveryPersonGateway(api);
  const myDeliveries = new HttpMyDeliveriesGateway(api);
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
      loadMyDeliveries: new LoadMyDeliveriesUseCase(myDeliveries),
      confirmMyDelivery: new ConfirmMyDeliveryUseCase(myDeliveries),
      updateMyLocation: new UpdateMyLocationUseCase(myDeliveries),
    },
  };
}
