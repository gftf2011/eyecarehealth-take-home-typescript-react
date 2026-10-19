import type { Page } from '../../../shared-kernel/application';
import { Product, type ProductDetails, type ProductListCriteria } from '../../domain';
import { buildProduct } from '../../domain/product/testing/product.fixture';
import type { ProductGateway } from '../ports/product-gateway';

/** Gateway em memória que registra o que recebeu (detalhes já validados). */
export class FakeProductGateway implements ProductGateway {
  products: Product[] = [buildProduct()];
  readonly listCalls: ProductListCriteria[] = [];
  readonly created: ProductDetails[] = [];
  readonly updates: { id: string; changes: Partial<ProductDetails> }[] = [];
  readonly removed: string[] = [];
  failWith: Error | null = null;

  list(criteria: ProductListCriteria): Promise<Page<Product>> {
    this.listCalls.push(criteria);
    return Promise.resolve({
      data: this.products,
      pagination: { limit: criteria.limit, nextCursor: null, previousCursor: null },
    });
  }

  create(details: ProductDetails): Promise<Product> {
    if (this.failWith !== null) return Promise.reject(this.failWith);
    this.created.push(details);
    return Promise.resolve(this.#restore('product-new', details));
  }

  update(id: string, changes: Partial<ProductDetails>): Promise<Product> {
    if (this.failWith !== null) return Promise.reject(this.failWith);
    this.updates.push({ id, changes });
    const current = buildProduct({ id });
    return Promise.resolve(
      this.#restore(id, {
        name: changes.name ?? current.name,
        description: changes.description ?? current.description,
        price: changes.price ?? current.price,
        category: changes.category ?? current.category,
        imageUrl: changes.imageUrl === undefined ? current.imageUrl : changes.imageUrl,
        preparationTime: changes.preparationTime ?? current.preparationTime,
        isAvailable: changes.isAvailable ?? current.isAvailable,
      }),
    );
  }

  remove(id: string): Promise<void> {
    if (this.failWith !== null) return Promise.reject(this.failWith);
    this.removed.push(id);
    return Promise.resolve();
  }

  #restore(id: string, details: ProductDetails): Product {
    const now = new Date('2026-10-17T12:00:00Z');
    return Product.restore({ ...details, id, createdAt: now, updatedAt: now });
  }
}
