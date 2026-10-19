import { AggregateRoot, Money } from '../../../shared-kernel/domain';
import { OrderItemId } from './entities/order-item-id';
import { OrderItem } from './entities/order-item';
import type { DeliveryIssue, DeliveryIssueResolution } from './entities/delivery-issue';
import type { DeliveryIssueId } from './entities/delivery-issue-id';
import { DeliveryIssueLog } from './entities/delivery-issue-log';
import {
  DeliveryIssueOpenError,
  DeliveryNotInProgressError,
  DeliveryPersonAssignmentNotAllowedError,
  DeliveryPersonUnavailableError,
  EmptyOrderError,
  InvalidStatusTransitionError,
  UnavailableProductError,
} from './errors';
import {
  DeliveryIssueReported,
  DeliveryIssueResolved,
  DeliveryPersonAssigned,
  DeliveryPersonUnassigned,
  OrderPlaced,
  OrderStatusChanged,
} from './events';
import { mergeLinesByProduct, type PlaceOrderItem } from './order-lines';
import type { OrderId } from './order-id';
import type { CustomerName } from './value-objects/customer-name';
import type { DeliveryAddress } from './value-objects/delivery-address';
import type { DeliveryIssueNote } from './value-objects/delivery-issue-note';
import type { DeliveryIssueDecision, DeliveryIssueReason } from './value-objects/delivery-issue-reason';
import type { DeliveryPersonAvailability } from './value-objects/delivery-person-availability';
import type { DeliveryPersonId } from './value-objects/delivery-person-id';
import type { GeoLocation } from './value-objects/geo-location';
import { OrderStatus, type OrderStatusValue } from './value-objects/order-status';
import type { PhoneNumber } from './value-objects/phone-number';
import type { ReturnReason } from './value-objects/return-reason';
import { StatusChange } from './value-objects/status-change';


/** Status em que o entregador ainda pode ser definido ou trocado. */
const ASSIGNABLE_STATUSES: readonly OrderStatusValue[] = ['pending', 'preparing', 'ready'];

export type { PlaceOrderItem } from './order-lines';

export type PlaceOrderParams = {
  id: OrderId;
  customerName: CustomerName;
  customerPhone: PhoneNumber;
  deliveryAddress: DeliveryAddress;
  location: GeoLocation;
  items: readonly PlaceOrderItem[];
  now: Date;
};

export type OrderSnapshot = {
  customerName: CustomerName;
  customerPhone: PhoneNumber;
  deliveryAddress: DeliveryAddress;
  location: GeoLocation;
  items: readonly OrderItem[];
  status: OrderStatus;
  deliveryPersonId: DeliveryPersonId | null;
  statusHistory: readonly StatusChange[];
  /** Tentativas de entrega que falharam (abertas ou resolvidas), na ordem. */
  deliveryIssues: readonly DeliveryIssue[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Raiz do agregado Order (contexto Ordering).
 *
 * Invariantes:
 * - Tem ao menos um item; nenhum produto indisponível no momento do pedido.
 * - `totalAmount` é sempre derivado dos itens (unitPrice × quantity), nunca informado.
 * - Status só muda pelas transições da máquina de estados; `ready → delivering`
 *   (despacho) exige entregador atribuído, ativo e sem outra entrega em andamento.
 * - Entregador só é atribuído antes do despacho e se estiver ativo e livre.
 * - Uma entrega em andamento só volta para `ready` por `returnToAssignment`,
 *   com motivo e sem o entregador (a máquina de estados genérica não permite).
 * - Toda transição fica registrada no histórico de status.
 */
export class Order extends AggregateRoot<OrderId> {
  #state: OrderSnapshot;

  private constructor(id: OrderId, state: OrderSnapshot) {
    super(id);
    this.#state = state;
  }

  static place(params: PlaceOrderParams): Order {
    const lines = mergeLinesByProduct(params.items);
    if (lines.length === 0) throw new EmptyOrderError();

    const unavailable = lines.filter((line) => !line.product.isAvailable);
    if (unavailable.length > 0) {
      throw new UnavailableProductError(unavailable.map((line) => line.product));
    }

    const status = OrderStatus.of('pending');
    const order = new Order(params.id, {
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      deliveryAddress: params.deliveryAddress,
      location: params.location,
      items: lines.map((line) => OrderItem.create(OrderItemId.generate(), line.product, line.quantity)),
      status,
      deliveryPersonId: null,
      statusHistory: [StatusChange.record(null, status.value, params.now)],
      deliveryIssues: [],
      createdAt: new Date(params.now.getTime()),
      updatedAt: new Date(params.now.getTime()),
    });

    order.addDomainEvent(
      new OrderPlaced(order.id, params.now, {
        totalAmountCents: order.totalAmount.cents,
        items: order.items.map((item) => ({
          productId: item.productId.value,
          quantity: item.quantity.value,
          unitPriceCents: item.unitPrice.cents,
        })),
      }),
    );
    return order;
  }

  /** Reidrata a partir da persistência. Não emite eventos. */
  static reconstitute(id: OrderId, snapshot: OrderSnapshot): Order {
    return new Order(id, {
      ...snapshot,
      items: [...snapshot.items],
      statusHistory: [...snapshot.statusHistory],
      deliveryIssues: [...snapshot.deliveryIssues],
    });
  }

  get customerName(): CustomerName {
    return this.#state.customerName;
  }

  get customerPhone(): PhoneNumber {
    return this.#state.customerPhone;
  }

  get deliveryAddress(): DeliveryAddress {
    return this.#state.deliveryAddress;
  }

  get location(): GeoLocation {
    return this.#state.location;
  }

  get items(): readonly OrderItem[] {
    return [...this.#state.items];
  }

  get status(): OrderStatus {
    return this.#state.status;
  }

  get deliveryPersonId(): DeliveryPersonId | null {
    return this.#state.deliveryPersonId;
  }

  get statusHistory(): readonly StatusChange[] {
    return [...this.#state.statusHistory];
  }

  get createdAt(): Date {
    return new Date(this.#state.createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.#state.updatedAt.getTime());
  }

  get totalAmount(): Money {
    return this.#state.items.reduce((total, item) => total.add(item.subtotal), Money.zero());
  }

  get deliveryIssues(): readonly DeliveryIssue[] {
    return [...this.#state.deliveryIssues];
  }
  /** O problema relatado que espera o gestor, se houver (no máximo um). */
  get openDeliveryIssue(): DeliveryIssue | null {
    return DeliveryIssueLog.of(this.#state.deliveryIssues).open;
  }
  /** O que o gestor pode decidir agora (pelo motivo e pelo limite de tentativas). */
  get deliveryIssueDecisions(): readonly DeliveryIssueDecision[] {
    return DeliveryIssueLog.of(this.#state.deliveryIssues).decisions;
  }

  /** Instante da transição para `delivered`, ou `null` se ainda não foi entregue. */
  get deliveredAt(): Date | null {
    const delivery = this.#state.statusHistory.find((change) => change.to === 'delivered');
    return delivery === undefined ? null : delivery.changedAt;
  }

  snapshot(): OrderSnapshot {
    return {
      ...this.#state,
      items: this.items,
      statusHistory: this.statusHistory,
      deliveryIssues: this.deliveryIssues,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Transições que não dependem de fatos externos. O despacho
   * (`ready → delivering`) passa por `dispatch`, que exige a disponibilidade
   * atual do entregador.
   */
  changeStatus(next: OrderStatus, now: Date): void {
    const current = this.#state.status;

    if (!current.canTransitionTo(next)) {
      throw new InvalidStatusTransitionError(current.value, next.value);
    }
    if (next.is('delivering')) {
      throw new InvalidStatusTransitionError(
        current.value,
        next.value,
        'o despacho exige confirmar a disponibilidade do entregador',
      );
    }

    // Com problema relatado, a entrega só continua depois da decisão do gestor.
    if (next.is('delivered') && this.openDeliveryIssue !== null) throw new DeliveryIssueOpenError();
    this.transitionTo(next, now);
  }

  /**
   * Despacha o pedido (`ready → delivering`) com o entregador atribuído. A
   * disponibilidade vem do Delivery via camada anticorrupção, lida no momento
   * do despacho: o entregador pode ter sido atribuído a outro pedido `ready`
   * e despachado nele antes, e não pode ter duas entregas em andamento.
   */
  dispatch(availability: DeliveryPersonAvailability, now: Date): void {
    const assigned = this.ensureDispatchable();
    if (!assigned.equals(availability.deliveryPersonId)) {
      // Erro de programação: a disponibilidade consultada é de outro entregador.
      throw new Error(
        `Disponibilidade do entregador ${availability.deliveryPersonId.value} usada para despachar com ${assigned.value}`,
      );
    }
    if (!availability.canTakeOrder) throw new DeliveryPersonUnavailableError(availability);

    this.transitionTo(OrderStatus.of('delivering'), now);
  }

  /**
   * Verifica as condições do despacho que dependem só do pedido (status
   * `ready` e entregador atribuído) e devolve o entregador cuja
   * disponibilidade deve ser consultada antes de `dispatch`.
   */
  ensureDispatchable(): DeliveryPersonId {
    const current = this.#state.status;
    const delivering = OrderStatus.of('delivering');

    if (!current.canTransitionTo(delivering)) {
      throw new InvalidStatusTransitionError(current.value, delivering.value);
    }
    if (this.#state.deliveryPersonId === null) {
      throw new InvalidStatusTransitionError(
        current.value,
        delivering.value,
        'é obrigatório ter um entregador atribuído',
      );
    }
    return this.#state.deliveryPersonId;
  }

  private transitionTo(next: OrderStatus, now: Date, reason: string | null = null): void {
    const current = this.#state.status;
    this.#state = {
      ...this.#state,
      status: next,
      statusHistory: [
        ...this.#state.statusHistory,
        StatusChange.record(current.value, next.value, now, reason),
      ],
      updatedAt: new Date(now.getTime()),
    };

    this.addDomainEvent(
      new OrderStatusChanged(this.id, now, {
        from: current.value,
        to: next.value,
        deliveryPersonId: this.#state.deliveryPersonId?.value ?? null,
      }),
    );
  }

  /**
   * Atribui (ou troca) o entregador. A disponibilidade vem do contexto Delivery
   * via camada anticorrupção; aqui se garante a regra com esse fato.
   */
  assignDeliveryPerson(availability: DeliveryPersonAvailability, now: Date): void {
    const { status, deliveryPersonId: previous } = this.#state;

    if (!ASSIGNABLE_STATUSES.includes(status.value)) {
      throw new DeliveryPersonAssignmentNotAllowedError(status.value);
    }
    if (previous !== null && previous.equals(availability.deliveryPersonId)) return;
    if (!availability.canTakeOrder) throw new DeliveryPersonUnavailableError(availability);

    this.#state = {
      ...this.#state,
      deliveryPersonId: availability.deliveryPersonId,
      updatedAt: new Date(now.getTime()),
    };

    this.addDomainEvent(
      new DeliveryPersonAssigned(this.id, now, {
        deliveryPersonId: availability.deliveryPersonId.value,
        previousDeliveryPersonId: previous?.value ?? null,
      }),
    );
  }

  /**
   * Devolve a entrega em andamento para a atribuição (`delivering → ready`),
   * sem entregador e com o motivo no histórico. Decisão do gestor, nunca
   * automática: a comida está com o entregador (ADR-29).
   */
  returnToAssignment(reason: ReturnReason, now: Date): void {
    const { status, deliveryPersonId: previous } = this.#state;
    const ready = OrderStatus.of('ready');
    if (!status.is('delivering') || previous === null) {
      throw new InvalidStatusTransitionError(
        status.value,
        ready.value,
        'só uma entrega em andamento volta para a atribuição',
      );
    }

    if (this.openDeliveryIssue !== null) this.resolveOpenIssue('returned', now);
    this.#state = { ...this.#state, deliveryPersonId: null };
    this.transitionTo(ready, now, reason.value);
    this.addDomainEvent(new DeliveryPersonUnassigned(this.id, now, { previousDeliveryPersonId: previous.value }));
  }

  /**
   * Tira o entregador de um pedido que ainda não saiu (`pending`, `preparing`
   * ou `ready`): ele foi desativado ou removido e não pode mais levá-lo. O
   * pedido volta para a fila de atribuição. Sem entregador, não faz nada.
   */
  releaseDeliveryPerson(now: Date): void {
    const { status, deliveryPersonId: previous } = this.#state;
    if (previous === null) return;
    if (!ASSIGNABLE_STATUSES.includes(status.value)) {
      throw new DeliveryPersonAssignmentNotAllowedError(status.value);
    }

    this.#state = { ...this.#state, deliveryPersonId: null, updatedAt: new Date(now.getTime()) };
    this.addDomainEvent(new DeliveryPersonUnassigned(this.id, now, { previousDeliveryPersonId: previous.value }));
  }

  /**
   * O entregador não conseguiu entregar (cliente ausente, endereço não
   * encontrado, recusa): relata o motivo e o gestor decide. O pedido segue
   * `delivering`, com ele.
   */
  reportDeliveryIssue(params: { id: DeliveryIssueId; reason: DeliveryIssueReason; note: DeliveryIssueNote | null; now: Date }): void {
    const courier = this.#state.deliveryPersonId;
    if (!this.#state.status.is('delivering') || courier === null) throw new DeliveryNotInProgressError();

    const { log, issue } = DeliveryIssueLog.of(this.#state.deliveryIssues).report({ ...params, reportedBy: courier });
    this.#state = { ...this.#state, deliveryIssues: log.issues, updatedAt: new Date(params.now.getTime()) };
    this.addDomainEvent(
      new DeliveryIssueReported(this.id, params.now, { issueId: issue.id.value, reason: issue.reason.value, deliveryPersonId: courier.value }),
    );
  }

  /** O gestor manda tentar de novo: o problema termina e o entregador segue com o pedido. */
  retryDelivery(now: Date): void {
    this.resolveOpenIssue('retried', now);
    this.#state = { ...this.#state, updatedAt: new Date(now.getTime()) };
  }

  /** A única saída `delivering → cancelled`: o gestor cancela a entrega que falhou (com o motivo relatado). */
  cancelFailedDelivery(now: Date): void {
    const issue = this.resolveOpenIssue('cancelled', now);
    const note = issue.note === null ? '' : `: ${issue.note.value}`;
    this.transitionTo(OrderStatus.of('cancelled'), now, `Entrega não realizada (${issue.reason.description})${note}`);
  }

  private resolveOpenIssue(resolution: DeliveryIssueResolution, now: Date): DeliveryIssue {
    const { log, issue } = DeliveryIssueLog.of(this.#state.deliveryIssues).resolveOpen(resolution, now);
    this.#state = { ...this.#state, deliveryIssues: log.issues };
    this.addDomainEvent(
      new DeliveryIssueResolved(this.id, now, { issueId: issue.id.value, resolution, deliveryPersonId: issue.reportedBy.value }),
    );
    return issue;
  }
}
