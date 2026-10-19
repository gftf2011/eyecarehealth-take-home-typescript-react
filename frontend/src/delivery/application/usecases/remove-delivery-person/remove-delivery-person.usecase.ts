import type { UseCase } from '../../../../shared-kernel/application';
import type { DeliveryPersonGateway } from '../../ports/delivery-person-gateway';

export type RemoveDeliveryPersonInput = { readonly id: string };

/**
 * Remove o entregador da frota (soft delete: pedidos antigos continuam
 * mostrando-o). Com entrega em andamento, a API recusa com
 * `409 DELIVERY_PERSON_IN_USE`.
 */
export class RemoveDeliveryPersonUseCase implements UseCase<RemoveDeliveryPersonInput, void> {
  constructor(private readonly deliveryPersons: DeliveryPersonGateway) {}

  execute({ id }: RemoveDeliveryPersonInput): Promise<void> {
    return this.deliveryPersons.remove(id);
  }
}
