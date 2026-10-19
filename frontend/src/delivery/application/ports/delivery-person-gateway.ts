import type { DeliveryPerson, DeliveryPersonDetails, DeliveryPersonListCriteria } from '../../domain';
import type { RequestOptions } from './dispatch-board-gateway';

/** Entregadores na API (`/delivery-persons`): a fonte da verdade, que valida tudo de novo. */
export interface DeliveryPersonGateway {
  list(criteria: DeliveryPersonListCriteria, options?: RequestOptions): Promise<readonly DeliveryPerson[]>;
  register(details: DeliveryPersonDetails): Promise<DeliveryPerson>;
  /** Atualização parcial: só os campos informados mudam (`location: null` apaga a posição). */
  update(id: string, changes: Partial<DeliveryPersonDetails>): Promise<DeliveryPerson>;
  /** Soft delete; `409 DELIVERY_PERSON_IN_USE` se ele estiver com uma entrega em andamento. */
  remove(id: string): Promise<void>;
}
