import { Entity, type Money } from '../../../../shared-kernel/domain/index';
import type { ProductId } from '../value-objects/product-id';
import type { ProductSnapshot } from '../value-objects/product-snapshot';
import type { Quantity } from '../value-objects/quantity';
import type { OrderItemId } from './order-item-id';

export type OrderItemSnapshot = {
  productId: ProductId;
  productName: string;
  /** Preço do produto no momento do pedido; não muda se o Catalog reajustar. */
  unitPrice: Money;
  quantity: Quantity;
};

/**
 * Entidade interna do agregado Order. Só é criada e alterada através da raiz
 * (Order); não tem repositório próprio.
 */
export class OrderItem extends Entity<OrderItemId> {
  readonly #props: OrderItemSnapshot;

  private constructor(id: OrderItemId, props: OrderItemSnapshot) {
    super(id);
    this.#props = props;
  }

  static create(id: OrderItemId, product: ProductSnapshot, quantity: Quantity): OrderItem {
    return new OrderItem(id, {
      productId: product.productId,
      productName: product.name,
      unitPrice: product.unitPrice,
      quantity,
    });
  }

  static reconstitute(id: OrderItemId, snapshot: OrderItemSnapshot): OrderItem {
    return new OrderItem(id, { ...snapshot });
  }

  get productId(): ProductId {
    return this.#props.productId;
  }

  get productName(): string {
    return this.#props.productName;
  }

  get unitPrice(): Money {
    return this.#props.unitPrice;
  }

  get quantity(): Quantity {
    return this.#props.quantity;
  }

  get subtotal(): Money {
    return this.#props.unitPrice.multiply(this.#props.quantity.value);
  }

  snapshot(): OrderItemSnapshot {
    return { ...this.#props };
  }
}
