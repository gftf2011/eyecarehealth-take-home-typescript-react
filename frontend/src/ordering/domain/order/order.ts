import type { Money } from '../../../shared-kernel/domain';
import type { OrderStatus, OrderStatusValue } from './value-objects/order-status';

export type OrderItem = {
  readonly id: string;
  readonly productId: string;
  /** Nome do produto no momento do pedido (snapshot). */
  readonly productName: string;
  readonly quantity: number;
  /** Preço no momento do pedido (snapshot). */
  readonly unitPrice: Money;
};

export type AssignedDeliveryPerson = {
  readonly id: string;
  readonly name: string;
};

export type OrderProps = {
  readonly id: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly deliveryAddress: string;
  readonly status: OrderStatus;
  readonly items: readonly OrderItem[];
  /** Calculado pela API (soma de preço × quantidade). */
  readonly totalAmount: Money;
  readonly deliveryPerson: AssignedDeliveryPerson | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** Condição que impede uma transição prevista na máquina de estados. */
export type TransitionBlocker = 'DELIVERY_PERSON_REQUIRED';

export type StatusTransition = {
  readonly to: OrderStatusValue;
  /** `null` quando a transição pode ser feita agora. */
  readonly blockedBy: TransitionBlocker | null;
};

/**
 * Pedido como o painel o enxerga. Concentra a regra que decide os botões de
 * cada pedido: as transições da máquina de estados, com a condição extra de
 * `ready → delivering` (entregador atribuído), como na API — que continua
 * validando tudo de novo ao receber a mudança.
 */
export class Order {
  private constructor(private readonly props: OrderProps) {}

  static restore(props: OrderProps): Order {
    return new Order({ ...props, items: [...props.items] });
  }

  get id(): string {
    return this.props.id;
  }

  get customerName(): string {
    return this.props.customerName;
  }

  get customerPhone(): string {
    return this.props.customerPhone;
  }

  get deliveryAddress(): string {
    return this.props.deliveryAddress;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get items(): readonly OrderItem[] {
    return this.props.items;
  }

  get totalAmount(): Money {
    return this.props.totalAmount;
  }

  get deliveryPerson(): AssignedDeliveryPerson | null {
    return this.props.deliveryPerson;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  get itemCount(): number {
    return this.props.items.reduce((total, item) => total + item.quantity, 0);
  }

  /** Transições oferecidas a partir do status atual, com o motivo quando bloqueadas. */
  transitions(): readonly StatusTransition[] {
    return this.props.status.allowedTransitions.map((to) => ({ to, blockedBy: this.#blockerFor(to) }));
  }

  #blockerFor(next: OrderStatusValue): TransitionBlocker | null {
    return next === 'delivering' && this.props.deliveryPerson === null ? 'DELIVERY_PERSON_REQUIRED' : null;
  }
}
