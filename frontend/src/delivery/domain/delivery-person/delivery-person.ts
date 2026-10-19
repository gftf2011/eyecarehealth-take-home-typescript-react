import type { GeoLocation } from './value-objects/geo-location';
import type { PersonName } from './value-objects/person-name';
import type { PhoneNumber } from './value-objects/phone-number';
import type { VehicleType } from './value-objects/vehicle-type';

/** Dados editáveis de um entregador, já validados pelos Value Objects. */
export type DeliveryPersonDetails = {
  readonly name: PersonName;
  readonly phone: PhoneNumber;
  readonly vehicleType: VehicleType;
  readonly isActive: boolean;
  /** `null`: posição desconhecida (ele fica fora do cálculo de distâncias). */
  readonly location: GeoLocation | null;
};

export type DeliveryPersonProps = DeliveryPersonDetails & {
  readonly id: string;
  /** Pedido `delivering` dele, se houver (vem do Ordering pela API). */
  readonly currentOrderId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * Entregador da frota. Inativo não recebe atribuições; com entrega em
 * andamento, não pode ser removido (a API recusa com `409`).
 */
export class DeliveryPerson {
  private constructor(private readonly props: DeliveryPersonProps) {}

  static restore(props: DeliveryPersonProps): DeliveryPerson {
    return new DeliveryPerson(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): PersonName {
    return this.props.name;
  }

  get phone(): PhoneNumber {
    return this.props.phone;
  }

  get vehicleType(): VehicleType {
    return this.props.vehicleType;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get location(): GeoLocation | null {
    return this.props.location;
  }

  get currentOrderId(): string | null {
    return this.props.currentOrderId;
  }

  /** Com um pedido em `delivering`: não está livre para outra entrega. */
  get isOnDelivery(): boolean {
    return this.props.currentOrderId !== null;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }
}
