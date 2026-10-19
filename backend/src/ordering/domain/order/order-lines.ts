import type { ProductSnapshot } from './value-objects/product-snapshot';
import type { Quantity } from './value-objects/quantity';

export type PlaceOrderItem = {
  product: ProductSnapshot;
  quantity: Quantity;
};

/** O mesmo produto repetido vira uma única linha com as quantidades somadas. */
export function mergeLinesByProduct(items: readonly PlaceOrderItem[]): PlaceOrderItem[] {
  const lines = new Map<string, PlaceOrderItem>();
  for (const item of items) {
    const key = item.product.productId.value;
    const existing = lines.get(key);
    lines.set(
      key,
      existing === undefined ? item : { product: existing.product, quantity: existing.quantity.add(item.quantity) },
    );
  }
  return [...lines.values()];
}
