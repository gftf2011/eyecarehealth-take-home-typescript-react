import type { DomainEvent } from '../../../shared-kernel/domain';
import {
  Order,
  OrderId,
  type DeliveryPersonAvailability,
  type DeliveryPersonId,
  type OrderRepository,
  type OrderSnapshot,
  type ProductId,
  type ProductSnapshot,
} from '../../domain';
import type { DeliveryPersonDirectory } from '../ports/delivery-person-directory';
import type { ProductCatalog } from '../ports/product-catalog';
import type { OrderingRepositories, OrderingUnitOfWork } from '../ports/ordering-unit-of-work';

/**
 * Unidade de trabalho em memória com semântica transacional real: as escritas
 * ficam em uma área temporária e só são aplicadas (e os eventos, registrados em
 * `publishedEvents` como entregues ao mediador) se a transação terminar sem
 * erro. Guarda snapshots, não instâncias,
 * para que nada vaze entre transações.
 */
export class InMemoryOrderingUnitOfWork implements OrderingUnitOfWork {
  readonly orders = new Map<string, OrderSnapshot>();
  readonly publishedEvents: DomainEvent[] = [];
  /** Produtos visíveis no Catalog (existentes e não removidos). */
  readonly catalog = new Map<string, ProductSnapshot>();
  /** IDs pedidos ao Catalog em cada consulta, na ordem das chamadas. */
  readonly catalogLookups: string[][] = [];
  /** Entregadores existentes no Delivery, com a disponibilidade atual. */
  readonly deliveryPersons = new Map<string, DeliveryPersonAvailability>();
  /** IDs consultados (e travados) no Delivery, na ordem das chamadas. */
  readonly deliveryPersonLookups: string[] = [];
  commits = 0;
  rollbacks = 0;
  #failNextCommit: Error | null = null;

  /** Simula produtos existentes no Catalog. */
  givenCatalogProducts(...products: ProductSnapshot[]): void {
    for (const product of products) this.catalog.set(product.productId.value, product);
  }

  /** Simula entregadores existentes no Delivery. */
  givenDeliveryPersons(...availabilities: DeliveryPersonAvailability[]): void {
    for (const availability of availabilities) {
      this.deliveryPersons.set(availability.deliveryPersonId.value, availability);
    }
  }

  /** Pré-carrega pedidos já confirmados (estado inicial do teste), descartando os eventos. */
  givenOrders(...orders: Order[]): void {
    for (const order of orders) {
      order.pullDomainEvents();
      this.orders.set(order.id.value, order.snapshot());
    }
  }

  /** Lê o estado confirmado de um pedido, como o próximo caso de uso o veria. */
  committedOrder(id: string): Order | undefined {
    const snapshot = this.orders.get(id);
    return snapshot === undefined ? undefined : Order.reconstitute(OrderId.from(id), snapshot);
  }

  /** Faz o próximo commit falhar, simulando erro do banco após as escritas. */
  failNextCommitWith(error: Error): void {
    this.#failNextCommit = error;
  }

  async transaction<TResult>(
    work: (repositories: OrderingRepositories) => Promise<TResult>,
  ): Promise<TResult> {
    const staged = new Map<string, OrderSnapshot>();
    const stagedEvents: DomainEvent[] = [];

    try {
      const result = await work({
        orders: new InMemoryOrderRepository(this.orders, staged, stagedEvents),
        products: new InMemoryProductCatalog(this.catalog, this.catalogLookups),
        deliveryPersons: new InMemoryDeliveryPersonDirectory(
          this.deliveryPersons,
          this.deliveryPersonLookups,
        ),
      });

      if (this.#failNextCommit !== null) {
        const error = this.#failNextCommit;
        this.#failNextCommit = null;
        throw error;
      }

      for (const [id, snapshot] of staged) this.orders.set(id, snapshot);
      this.publishedEvents.push(...stagedEvents);
      this.commits += 1;
      return result;
    } catch (error) {
      this.rollbacks += 1;
      throw error;
    }
  }
}

class InMemoryOrderRepository implements OrderRepository {
  constructor(
    private readonly committed: ReadonlyMap<string, OrderSnapshot>,
    private readonly staged: Map<string, OrderSnapshot>,
    private readonly stagedEvents: DomainEvent[],
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    const snapshot = this.staged.get(id.value) ?? this.committed.get(id.value);
    return snapshot === undefined ? null : Order.reconstitute(id, snapshot);
  }

  async save(order: Order): Promise<void> {
    this.staged.set(order.id.value, order.snapshot());
    this.stagedEvents.push(...order.pullDomainEvents());
  }
}

class InMemoryProductCatalog implements ProductCatalog {
  constructor(
    private readonly catalog: ReadonlyMap<string, ProductSnapshot>,
    private readonly lookups: string[][],
  ) {}

  async snapshotsOf(ids: readonly ProductId[]): Promise<readonly ProductSnapshot[]> {
    this.lookups.push(ids.map((id) => id.value));
    return ids.flatMap((id) => {
      const snapshot = this.catalog.get(id.value);
      return snapshot === undefined ? [] : [snapshot];
    });
  }
}

class InMemoryDeliveryPersonDirectory implements DeliveryPersonDirectory {
  constructor(
    private readonly deliveryPersons: ReadonlyMap<string, DeliveryPersonAvailability>,
    private readonly lookups: string[],
  ) {}

  async availabilityOf(id: DeliveryPersonId): Promise<DeliveryPersonAvailability | null> {
    this.lookups.push(id.value);
    return this.deliveryPersons.get(id.value) ?? null;
  }
}
