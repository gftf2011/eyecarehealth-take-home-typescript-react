import { InvalidMoneyError, ValueObject, type Money } from '../../../../shared-kernel/domain/index.js';
import type { ProductId } from './product-id.js';

/**
 * Visão que o Ordering tem de um produto no instante do pedido. É produzida pela
 * camada anticorrupção a partir do Catalog; o preço vira o `unitPrice` do item.
 */
export class ProductSnapshot extends ValueObject<{
  productId: ProductId;
  name: string;
  unitPrice: Money;
  isAvailable: boolean;
}> {
  private constructor(productId: ProductId, name: string, unitPrice: Money, isAvailable: boolean) {
    super({ productId, name, unitPrice, isAvailable });
  }

  static create(params: {
    productId: ProductId;
    name: string;
    unitPrice: Money;
    isAvailable: boolean;
  }): ProductSnapshot {
    if (!params.unitPrice.isPositive()) {
      throw new InvalidMoneyError('unitPrice', 'O preço unitário deve ser maior que zero');
    }
    return new ProductSnapshot(
      params.productId,
      params.name.trim(),
      params.unitPrice,
      params.isAvailable,
    );
  }

  get productId(): ProductId {
    return this.props.productId;
  }

  get name(): string {
    return this.props.name;
  }

  get unitPrice(): Money {
    return this.props.unitPrice;
  }

  get isAvailable(): boolean {
    return this.props.isAvailable;
  }
}
