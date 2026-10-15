import { AggregateRoot, type ValueObject } from '../../../shared-kernel/domain';
import type { ProductId } from './product-id';
import { ProductAlreadyRemovedError, ProductInUseError } from './errors';
import {
  ProductAvailabilityChanged,
  ProductCreated,
  ProductPriceChanged,
  ProductRemoved,
  ProductUpdated,
  type ProductDetailField,
} from './events';
import type { ImageUrl } from './value-objects/image-url';
import type { PreparationTime } from './value-objects/preparation-time';
import type { ProductCategory } from './value-objects/product-category';
import type { ProductDescription } from './value-objects/product-description';
import type { ProductName } from './value-objects/product-name';
import type { ProductPrice } from './value-objects/product-price';

/** Atributos que descrevem o produto no cardápio. */
export type ProductDetails = {
  name: ProductName;
  description: ProductDescription;
  price: ProductPrice;
  category: ProductCategory;
  imageUrl: ImageUrl | null;
  preparationTime: PreparationTime;
};

/**
 * Alteração parcial: campos ausentes (ou `undefined`) não mudam;
 * `imageUrl: null` remove a imagem.
 */
export type ProductDetailsChanges = {
  readonly [K in keyof ProductDetails]?: ProductDetails[K] | undefined;
};

export type CreateProductParams = ProductDetails & {
  id: ProductId;
  isAvailable?: boolean;
  now: Date;
};

export type ProductSnapshot = ProductDetails & {
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  removedAt: Date | null;
};

export type RemoveProductParams = {
  /** Fato vindo do contexto Ordering (via ACL): há pedidos pending/preparing com o produto? */
  hasActiveOrders: boolean;
  now: Date;
};

/**
 * Raiz do agregado Product (contexto Catalog).
 *
 * Invariantes:
 * - Todos os atributos são Value Objects já validados: o produto nunca existe inválido.
 * - Produto removido (soft delete) é imutável.
 * - Produto vinculado a pedidos ativos não pode ser removido.
 */
export class Product extends AggregateRoot<ProductId> {
  #state: ProductSnapshot;

  private constructor(id: ProductId, state: ProductSnapshot) {
    super(id);
    this.#state = state;
  }

  static create({ id, now, isAvailable = true, ...details }: CreateProductParams): Product {
    const product = new Product(id, {
      ...details,
      isAvailable,
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
      removedAt: null,
    });

    product.addDomainEvent(
      new ProductCreated(id, now, {
        name: details.name.value,
        priceCents: details.price.amount.cents,
        category: details.category.value,
        isAvailable,
      }),
    );
    return product;
  }

  /** Reidrata a partir da persistência. Não emite eventos. */
  static reconstitute(id: ProductId, snapshot: ProductSnapshot): Product {
    return new Product(id, { ...snapshot });
  }

  get name(): ProductName {
    return this.#state.name;
  }

  get description(): ProductDescription {
    return this.#state.description;
  }

  get price(): ProductPrice {
    return this.#state.price;
  }

  get category(): ProductCategory {
    return this.#state.category;
  }

  get imageUrl(): ImageUrl | null {
    return this.#state.imageUrl;
  }

  get preparationTime(): PreparationTime {
    return this.#state.preparationTime;
  }

  get isAvailable(): boolean {
    return this.#state.isAvailable;
  }

  get createdAt(): Date {
    return new Date(this.#state.createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.#state.updatedAt.getTime());
  }

  get removedAt(): Date | null {
    return this.#state.removedAt === null ? null : new Date(this.#state.removedAt.getTime());
  }

  get isRemoved(): boolean {
    return this.#state.removedAt !== null;
  }

  /** Pode entrar em um novo pedido e aparecer nas listagens públicas. */
  get isOrderable(): boolean {
    return this.#state.isAvailable && !this.isRemoved;
  }

  snapshot(): ProductSnapshot {
    return {
      ...this.#state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      removedAt: this.removedAt,
    };
  }

  updateDetails(changes: ProductDetailsChanges, now: Date): void {
    this.ensureNotRemoved();

    const next: ProductDetails = { ...this.#state };
    const changedFields: ProductDetailField[] = [];

    if (changes.name !== undefined && hasChanged(next.name, changes.name)) {
      next.name = changes.name;
      changedFields.push('name');
    }
    if (changes.description !== undefined && hasChanged(next.description, changes.description)) {
      next.description = changes.description;
      changedFields.push('description');
    }
    if (changes.price !== undefined && hasChanged(next.price, changes.price)) {
      next.price = changes.price;
      changedFields.push('price');
    }
    if (changes.category !== undefined && hasChanged(next.category, changes.category)) {
      next.category = changes.category;
      changedFields.push('category');
    }
    if (changes.imageUrl !== undefined && hasChanged(next.imageUrl, changes.imageUrl)) {
      next.imageUrl = changes.imageUrl;
      changedFields.push('imageUrl');
    }
    if (
      changes.preparationTime !== undefined &&
      hasChanged(next.preparationTime, changes.preparationTime)
    ) {
      next.preparationTime = changes.preparationTime;
      changedFields.push('preparationTime');
    }

    if (changedFields.length === 0) return;

    const previousPrice = this.#state.price;
    this.#state = { ...this.#state, ...next, updatedAt: new Date(now.getTime()) };

    this.addDomainEvent(new ProductUpdated(this.id, now, { changedFields }));
    if (changedFields.includes('price')) {
      this.addDomainEvent(
        new ProductPriceChanged(this.id, now, {
          previousPriceCents: previousPrice.amount.cents,
          newPriceCents: next.price.amount.cents,
        }),
      );
    }
  }

  makeAvailable(now: Date): void {
    this.changeAvailability(true, now);
  }

  makeUnavailable(now: Date): void {
    this.changeAvailability(false, now);
  }

  remove({ hasActiveOrders, now }: RemoveProductParams): void {
    this.ensureNotRemoved();
    if (hasActiveOrders) throw new ProductInUseError(this.id);

    this.#state = {
      ...this.#state,
      removedAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
    };
    this.addDomainEvent(new ProductRemoved(this.id, now));
  }

  private changeAvailability(isAvailable: boolean, now: Date): void {
    this.ensureNotRemoved();
    if (this.#state.isAvailable === isAvailable) return;

    this.#state = { ...this.#state, isAvailable, updatedAt: new Date(now.getTime()) };
    this.addDomainEvent(new ProductAvailabilityChanged(this.id, now, { isAvailable }));
  }

  private ensureNotRemoved(): void {
    if (this.isRemoved) throw new ProductAlreadyRemovedError(this.id);
  }
}

function hasChanged<T extends ValueObject<object>>(current: T | null, next: T | null): boolean {
  if (current === null || next === null) return current !== next;
  return !current.equals(next);
}
