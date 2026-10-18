import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidOrderStatusError } from '../errors';

export const ORDER_STATUSES = [
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'cancelled',
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

/**
 * A mesma máquina de estados da API. O painel só oferece as transições desta
 * tabela; qualquer outra é recusada antes mesmo de chegar ao servidor.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatusValue, readonly OrderStatusValue[]>> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivering', 'cancelled'],
  delivering: ['delivered'],
  delivered: [],
  cancelled: [],
};

export class OrderStatus extends ValueObject<{ value: OrderStatusValue }> {
  private constructor(value: OrderStatusValue) {
    super({ value });
  }

  static of(value: OrderStatusValue): OrderStatus {
    return new OrderStatus(value);
  }

  static create(raw: string, field = 'status'): OrderStatus {
    if (!OrderStatus.isValid(raw)) {
      throw new InvalidOrderStatusError(field, `O status deve ser um de: ${ORDER_STATUSES.join(', ')}`);
    }
    return new OrderStatus(raw);
  }

  static isValid(raw: string): raw is OrderStatusValue {
    return (ORDER_STATUSES as readonly string[]).includes(raw);
  }

  get value(): OrderStatusValue {
    return this.props.value;
  }

  /** Status para os quais o pedido pode ir a partir do atual. */
  get allowedTransitions(): readonly OrderStatusValue[] {
    return ALLOWED_TRANSITIONS[this.props.value];
  }

  get isFinal(): boolean {
    return this.allowedTransitions.length === 0;
  }

  canTransitionTo(next: OrderStatusValue): boolean {
    return this.allowedTransitions.includes(next);
  }
}
