import { keysetSliceInMemory } from '../../../shared-kernel/application/testing/in-memory-keyset';
import type { DomainEvent, KeysetSlice } from '../../../shared-kernel/domain';
import {
  PRODUCT_SORT_KEYS,
  Product,
  ProductId,
  type ProductListCriteria,
  type ProductRepository,
  type ProductSnapshot,
} from '../../domain';
import type { CatalogRepositories, CatalogUnitOfWork } from '../ports/catalog-unit-of-work';

/**
 * Unidade de trabalho em memória com semântica transacional real: as escritas
 * ficam em uma área temporária e só são aplicadas (e os eventos, registrados em
 * `publishedEvents` como entregues ao mediador) se a transação terminar sem
 * erro. Guarda snapshots, não instâncias,
 * para que nada vaze entre transações.
 */
export class InMemoryCatalogUnitOfWork implements CatalogUnitOfWork {
  readonly products = new Map<string, ProductSnapshot>();
  readonly publishedEvents: DomainEvent[] = [];
  /** IDs de produtos presentes em pedidos `pending`/`preparing` (fato do Ordering). */
  readonly productsInActiveOrders = new Set<string>();
  commits = 0;
  rollbacks = 0;
  #failNextCommit: Error | null = null;

  /** Pré-carrega produtos já confirmados (estado inicial do teste), descartando os eventos. */
  givenProducts(...products: Product[]): void {
    for (const product of products) {
      product.pullDomainEvents();
      this.products.set(product.id.value, product.snapshot());
    }
  }

  /** Simula pedidos em aberto (no Ordering) contendo estes produtos. */
  givenActiveOrdersFor(...products: Product[]): void {
    for (const product of products) this.productsInActiveOrders.add(product.id.value);
  }

  /** Lê o estado confirmado de um produto, como o próximo caso de uso o veria. */
  committedProduct(id: string): Product | undefined {
    const snapshot = this.products.get(id);
    return snapshot === undefined ? undefined : Product.reconstitute(ProductId.from(id), snapshot);
  }

  /** Faz o próximo commit falhar, simulando erro do banco após as escritas. */
  failNextCommitWith(error: Error): void {
    this.#failNextCommit = error;
  }

  async transaction<TResult>(
    work: (repositories: CatalogRepositories) => Promise<TResult>,
  ): Promise<TResult> {
    const staged = new Map<string, ProductSnapshot>();
    const stagedEvents: DomainEvent[] = [];

    try {
      const result = await work({
        products: new InMemoryProductRepository(this.products, staged, stagedEvents),
        activeOrders: {
          hasActiveOrdersFor: async (productId) => this.productsInActiveOrders.has(productId.value),
        },
      });

      if (this.#failNextCommit !== null) {
        const error = this.#failNextCommit;
        this.#failNextCommit = null;
        throw error;
      }

      for (const [id, snapshot] of staged) this.products.set(id, snapshot);
      this.publishedEvents.push(...stagedEvents);
      this.commits += 1;
      return result;
    } catch (error) {
      this.rollbacks += 1;
      throw error;
    }
  }
}

class InMemoryProductRepository implements ProductRepository {
  constructor(
    private readonly committed: ReadonlyMap<string, ProductSnapshot>,
    private readonly staged: Map<string, ProductSnapshot>,
    private readonly stagedEvents: DomainEvent[],
  ) {}

  async findById(id: ProductId): Promise<Product | null> {
    const snapshot = this.staged.get(id.value) ?? this.committed.get(id.value);
    if (snapshot === undefined || snapshot.removedAt !== null) return null;
    return Product.reconstitute(id, snapshot);
  }

  async save(product: Product): Promise<void> {
    this.staged.set(product.id.value, product.snapshot());
    this.stagedEvents.push(...product.pullDomainEvents());
  }

  /** Mesma semântica esperada do SQL: filtros, ordenação estável e keyset. */
  async list(criteria: ProductListCriteria): Promise<KeysetSlice<Product>> {
    const visible = [...new Map([...this.committed, ...this.staged])]
      .map(([id, snapshot]) => Product.reconstitute(ProductId.from(id), snapshot))
      .filter((product) => matches(product, criteria));
    return keysetSliceInMemory(visible, criteria, PRODUCT_SORT_KEYS[criteria.sort.field]);
  }
}

function matches(product: Product, criteria: ProductListCriteria): boolean {
  if (product.isRemoved) return false;
  if (criteria.visibility === 'public' && !product.isAvailable) return false;
  if (criteria.isAvailable !== null && product.isAvailable !== criteria.isAvailable) return false;
  if (criteria.category !== null && product.category.value !== criteria.category) return false;
  if (criteria.search !== null) {
    return product.name.value.toLowerCase().includes(criteria.search.toLowerCase());
  }
  return true;
}
