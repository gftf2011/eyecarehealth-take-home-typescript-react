import { ValueObject } from '../../../../shared-kernel/domain/index.js';
import type { OrderStatusValue } from './order-status.js';

/**
 * Registro de uma transição de status. O histórico permite medir o tempo até a
 * entrega (createdAt → transição para `delivered`).
 */
export class StatusChange extends ValueObject<{
  from: OrderStatusValue | null;
  to: OrderStatusValue;
  changedAt: Date;
}> {
  private constructor(from: OrderStatusValue | null, to: OrderStatusValue, changedAt: Date) {
    super({ from, to, changedAt: new Date(changedAt.getTime()) });
  }

  static record(from: OrderStatusValue | null, to: OrderStatusValue, changedAt: Date): StatusChange {
    return new StatusChange(from, to, changedAt);
  }

  get from(): OrderStatusValue | null {
    return this.props.from;
  }

  get to(): OrderStatusValue {
    return this.props.to;
  }

  get changedAt(): Date {
    return new Date(this.props.changedAt.getTime());
  }
}
