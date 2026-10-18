import { createContext, use, type ReactNode } from 'react';

import type { UseCase } from '../../../shared-kernel/application';
import type { AcceptAssignmentInput, RequestOptions } from '../../application';
import type { AssignmentPlan, DispatchBoard } from '../../domain';

/** Casos de uso da tela de atribuição. */
export type DeliveryServices = {
  readonly loadDispatchBoard: UseCase<RequestOptions, DispatchBoard>;
  readonly suggestAssignment: UseCase<void, AssignmentPlan>;
  readonly acceptAssignment: UseCase<AcceptAssignmentInput, AssignmentPlan>;
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
