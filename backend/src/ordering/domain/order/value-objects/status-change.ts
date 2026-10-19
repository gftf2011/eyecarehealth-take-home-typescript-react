import { ValueObject } from '../../../../shared-kernel/domain';
import type { OrderStatusValue } from './order-status';

/**
 * Registro de uma transição de status. O histórico permite medir o tempo até a
 * entrega (createdAt → transição para `delivered`) e guarda o motivo das
 * transições que exigem um (a entrega devolvida para a atribuição).
 */
export class StatusChange extends ValueObject<{
  from: OrderStatusValue | null;
  to: OrderStatusValue;
  changedAt: Date;
  reason: string | null;
}> {
  private constructor(from: OrderStatusValue | null, to: OrderStatusValue, changedAt: Date, reason: string | null) {
    super({ from, to, changedAt: new Date(changedAt.getTime()), reason });
  }

  static record(
    from: OrderStatusValue | null,
    to: OrderStatusValue,
    changedAt: Date,
    reason: string | null = null,
  ): StatusChange {
    return new StatusChange(from, to, changedAt, reason);
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

  get reason(): string | null {
    return this.props.reason;
  }
}
