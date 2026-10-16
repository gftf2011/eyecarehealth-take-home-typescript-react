import { AggregateRoot, Money } from '../../../shared-kernel/domain';
import { OrderItemId } from './entities/order-item-id';
import { OrderItem } from './entities/order-item';
import {
  DeliveryPersonAssignmentNotAllowedError,
  DeliveryPersonUnavailableError,
  EmptyOrderError,
  InvalidStatusTransitionError,
  UnavailableProductError,
} from './errors';
import { DeliveryPersonAssigned, OrderPlaced, OrderStatusChanged } from './events';
import type { OrderId } from './order-id';
import type { CustomerName } from './value-objects/customer-name';
import type { DeliveryAddress } from './value-objects/delivery-address';
import type { DeliveryPersonAvailability } from './value-objects/delivery-person-availability';
import type { DeliveryPersonId } from './value-objects/delivery-person-id';
import type { GeoLocation } from './value-objects/geo-location';
import { OrderStatus, type OrderStatusValue } from './value-objects/order-status';
import type { PhoneNumber } from './value-objects/phone-number';
import type { ProductSnapshot } from './value-objects/product-snapshot';
import type { Quantity } from './value-objects/quantity';
import { StatusChange } from './value-objects/status-change';

/** Status em que o entregador ainda pode ser definido ou trocado. */
const ASSIGNABLE_STATUSES: readonly OrderStatusValue[] = ['pending', 'preparing', 'ready'];

export type PlaceOrderItem = {
  product: ProductSnapshot;
  quantity: Quantity;
};

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
 * - Toda transição fica registrada no histórico de status.
 */
export class Order extends AggregateRoot<OrderId> {
  #state: OrderSnapshot;

  private constructor(id: OrderId, state: OrderSnapshot) {
    super(id);
    this.#state = state;
  }

  static place(params: PlaceOrderParams): Order {
    const lines = Order.mergeLinesByProduct(params.items);
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

  private transitionTo(next: OrderStatus, now: Date): void {
    const current = this.#state.status;
    this.#state = {
      ...this.#state,
      status: next,
      statusHistory: [
        ...this.#state.statusHistory,
        StatusChange.record(current.value, next.value, now),
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

  /** O mesmo produto repetido vira uma única linha com as quantidades somadas. */
  private static mergeLinesByProduct(items: readonly PlaceOrderItem[]): PlaceOrderItem[] {
    const lines = new Map<string, PlaceOrderItem>();
    for (const item of items) {
      const key = item.product.productId.value;
      const existing = lines.get(key);
      lines.set(
        key,
        existing === undefined
          ? item
          : { product: existing.product, quantity: existing.quantity.add(item.quantity) },
      );
    }
    return [...lines.values()];
  }
}
