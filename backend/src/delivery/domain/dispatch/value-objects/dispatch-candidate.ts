import { ValueObject } from '../../../../shared-kernel/domain/index.js';
import type { DeliveryPersonId } from '../../delivery-person/delivery-person-id.js';
import type { GeoPoint } from '../../location/geo-point.js';

/**
 * Entregador apto a receber um pedido (ativo e sem entrega em andamento).
 * Sem localização conhecida, não entra no cálculo de distâncias.
 */
export class DispatchCandidate extends ValueObject<{
  deliveryPersonId: DeliveryPersonId;
  location: GeoPoint | null;
}> {
  private constructor(deliveryPersonId: DeliveryPersonId, location: GeoPoint | null) {
    super({ deliveryPersonId, location });
  }

  static create(params: {
    deliveryPersonId: DeliveryPersonId;
    location: GeoPoint | null;
  }): DispatchCandidate {
    return new DispatchCandidate(params.deliveryPersonId, params.location);
  }

  get deliveryPersonId(): DeliveryPersonId {
    return this.props.deliveryPersonId;
  }

  get location(): GeoPoint | null {
    return this.props.location;
  }
}
