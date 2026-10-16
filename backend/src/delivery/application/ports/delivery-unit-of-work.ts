import type { UnitOfWork } from '../../../shared-kernel/application';
import type { DeliveryPersonRepository } from '../../domain';
import type { DispatchBoard } from './dispatch-board';

/**
 * O que o Delivery acessa dentro de uma transação: repositórios e as leituras
 * de outros contextos que precisam ser consistentes com eles.
 */
export type DeliveryRepositories = {
  readonly deliveryPersons: DeliveryPersonRepository;
  readonly dispatchBoard: DispatchBoard;
};

export type DeliveryUnitOfWork = UnitOfWork<DeliveryRepositories>;
