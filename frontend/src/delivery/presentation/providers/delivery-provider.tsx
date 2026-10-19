import { createContext, use, type ReactNode } from 'react';

import type { UseCase } from '../../../shared-kernel/application';
import type {
  AcceptAssignmentInput,
  ConfirmMyDeliveryInput,
  DeliveryPersonDto,
  DeliveryPersonFormInput,
  ListDeliveryPersonsInput,
  RemoveDeliveryPersonInput,
  RequestOptions,
  SetDeliveryPersonActivationInput,
  UpdateDeliveryPersonInput,
  UpdateMyLocationInput,
} from '../../application';
import type { AssignmentPlan, DispatchBoard, MyDeliveries } from '../../domain';

/** Casos de uso das telas de atribuição, de entregadores e do próprio entregador. */
export type DeliveryServices = {
  readonly loadDispatchBoard: UseCase<RequestOptions, DispatchBoard>;
  readonly suggestAssignment: UseCase<void, AssignmentPlan>;
  readonly acceptAssignment: UseCase<AcceptAssignmentInput, AssignmentPlan>;
  readonly listDeliveryPersons: UseCase<ListDeliveryPersonsInput & RequestOptions, readonly DeliveryPersonDto[]>;
  readonly registerDeliveryPerson: UseCase<DeliveryPersonFormInput, DeliveryPersonDto>;
  readonly updateDeliveryPerson: UseCase<UpdateDeliveryPersonInput, DeliveryPersonDto>;
  readonly setDeliveryPersonActivation: UseCase<SetDeliveryPersonActivationInput, DeliveryPersonDto>;
  readonly removeDeliveryPerson: UseCase<RemoveDeliveryPersonInput, void>;
  readonly loadMyDeliveries: UseCase<RequestOptions, MyDeliveries>;
  readonly confirmMyDelivery: UseCase<ConfirmMyDeliveryInput, void>;
  readonly updateMyLocation: UseCase<UpdateMyLocationInput, void>;
};

const DeliveryContext = createContext<DeliveryServices | null>(null);

export function DeliveryProvider({
  services,
  children,
}: {
  readonly services: DeliveryServices;
  readonly children: ReactNode;
}) {
  return <DeliveryContext value={services}>{children}</DeliveryContext>;
}

export function useDeliveryServices(): DeliveryServices {
  const services = use(DeliveryContext);
  if (services === null) throw new Error('useDeliveryServices precisa estar dentro de <DeliveryProvider>');
  return services;
}
