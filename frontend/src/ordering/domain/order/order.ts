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

/** Uma transição do histórico (a primeira, `from: null`, é a criação). */
export type StatusChange = {
  readonly from: OrderStatusValue | null;
  readonly to: OrderStatusValue;
  readonly changedAt: Date;
  /** Motivo, nas transições que exigem um (entrega devolvida para a atribuição). */
  readonly reason: string | null;
};

/** Por que a entrega falhou e como o problema terminou (mesmos valores da API). */
export const DELIVERY_ISSUE_REASONS = ['customer_absent', 'address_not_found', 'refused', 'other'] as const;
export type DeliveryIssueReason = (typeof DELIVERY_ISSUE_REASONS)[number];
export const DELIVERY_ISSUE_RESOLUTIONS = ['retried', 'returned', 'cancelled'] as const;
export type DeliveryIssueResolution = (typeof DELIVERY_ISSUE_RESOLUTIONS)[number];
/** O que o gestor pode decidir sobre a entrega que falhou (a API diz quais valem agora). */
export const DELIVERY_ISSUE_DECISIONS = ['retry', 'return', 'cancel'] as const;
export type DeliveryIssueDecision = (typeof DELIVERY_ISSUE_DECISIONS)[number];

/** Uma tentativa de entrega que falhou, relatada pelo entregador. */
export type DeliveryIssue = {
  readonly id: string;
  readonly reason: DeliveryIssueReason;
  readonly note: string | null;
  readonly reportedAt: Date;
  /** `null` enquanto espera a decisão do gestor. */
  readonly resolvedAt: Date | null;
  readonly resolution: DeliveryIssueResolution | null;
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
  /** Transições em ordem, da criação até o status atual. */
  readonly statusHistory: readonly StatusChange[];
  readonly deliveryIssues: readonly DeliveryIssue[];
  /** Decisões permitidas agora, calculadas pela API (motivo e limite de tentativas). */
  readonly deliveryIssueDecisions: readonly DeliveryIssueDecision[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** Condição que impede uma transição prevista na máquina de estados. */
export type TransitionBlocker = 'DELIVERY_PERSON_REQUIRED' | 'DELIVERY_ISSUE_OPEN';

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
    return new Order({
      ...props,
      items: [...props.items],
      statusHistory: [...props.statusHistory],
      deliveryIssues: [...props.deliveryIssues],
      deliveryIssueDecisions: [...props.deliveryIssueDecisions],
    });
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

  get statusHistory(): readonly StatusChange[] {
    return this.props.statusHistory;
  }

  get deliveryIssues(): readonly DeliveryIssue[] {
    return this.props.deliveryIssues;
  }

  /** O problema relatado pelo entregador que espera a decisão do gestor, se houver. */
  get openDeliveryIssue(): DeliveryIssue | null {
    return this.props.deliveryIssues.find((issue) => issue.resolvedAt === null) ?? null;
  }

  get deliveryIssueDecisions(): readonly DeliveryIssueDecision[] {
    return this.props.deliveryIssueDecisions;
  }

  /**
   * Uma entrega em andamento pode voltar para a atribuição (o gestor decide,
   * com motivo), a não ser que o problema relatado não permita (cliente recusou).
   */
  get canReturnToAssignment(): boolean {
    if (this.props.status.value !== 'delivering') return false;
    return this.openDeliveryIssue === null || this.props.deliveryIssueDecisions.includes('return');
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
    if (next === 'delivering' && this.props.deliveryPerson === null) return 'DELIVERY_PERSON_REQUIRED';
    // Com problema relatado, a entrega só continua depois da decisão do gestor.
    if (next === 'delivered' && this.openDeliveryIssue !== null) return 'DELIVERY_ISSUE_OPEN';
    return null;
  }
}
