import type { Order, OrderStatusValue } from '../../domain';

export type OrderItemDto = {
  readonly id: string;
  readonly product: { readonly id: string; readonly name: string };
  readonly quantity: number;
  /** Preço do produto no momento do pedido, em reais. */
  readonly unitPrice: number;
};

/** Representação de saída de um pedido: só tipos primitivos, sem VOs. */
export type OrderDto = {
  readonly id: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly deliveryAddress: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly status: OrderStatusValue;
  /** Soma de `unitPrice × quantity`, em reais. */
  readonly totalAmount: number;
  readonly deliveryPersonId: string | null;
  readonly items: readonly OrderItemDto[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function toOrderDto(order: Order): OrderDto {
  return {
    id: order.id.value,
    customerName: order.customerName.value,
    customerPhone: order.customerPhone.value,
    deliveryAddress: order.deliveryAddress.value,
    latitude: order.location.latitude,
    longitude: order.location.longitude,
    status: order.status.value,
    totalAmount: order.totalAmount.toDecimal(),
    deliveryPersonId: order.deliveryPersonId?.value ?? null,
    items: order.items.map((item) => ({
      id: item.id.value,
      product: { id: item.productId.value, name: item.productName },
      quantity: item.quantity.value,
      unitPrice: item.unitPrice.toDecimal(),
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
