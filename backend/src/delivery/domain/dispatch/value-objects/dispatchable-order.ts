import { ValueObject } from '../../../../shared-kernel/domain/index';
import type { GeoPoint } from '../../location/geo-point';
import type { OrderId } from './order-id';

/**
 * Visão que o Delivery tem de um pedido `ready` aguardando entregador. É
 * montada pela camada anticorrupção a partir do Ordering.
 */
export class DispatchableOrder extends ValueObject<{
  orderId: OrderId;
  deliveryAddress: string;
  location: GeoPoint;
}> {
  private constructor(orderId: OrderId, deliveryAddress: string, location: GeoPoint) {
    super({ orderId, deliveryAddress, location });
  }

  static create(params: {
    orderId: OrderId;
    deliveryAddress: string;
    location: GeoPoint;
  }): DispatchableOrder {
    return new DispatchableOrder(params.orderId, params.deliveryAddress, params.location);
  }

  get orderId(): OrderId {
    return this.props.orderId;
  }

  get deliveryAddress(): string {
    return this.props.deliveryAddress;
  }

  get location(): GeoPoint {
    return this.props.location;
  }
}
