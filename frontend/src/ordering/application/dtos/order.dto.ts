import type { Order, OrderStatusValue, StatusTransition } from '../../domain';

export type OrderItemDto = {
  readonly id: string;
  readonly productName: string;
  readonly quantity: number;
  /** Em centavos, para a interface formatar sem erro de arredondamento. */
  readonly unitPriceCents: number;
  readonly subtotalCents: number;
};

/** O que a interface mostra de um pedido, já com as ações possíveis. */
export type OrderDto = {
  readonly id: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly deliveryAddress: string;
  readonly status: OrderStatusValue;
  readonly items: readonly OrderItemDto[];
  readonly itemCount: number;
  readonly totalCents: number;
  readonly deliveryPerson: { readonly id: string; readonly name: string } | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Transições oferecidas a partir do status atual (botões contextuais). */
  readonly transitions: readonly StatusTransition[];
};

export function toOrderDto(order: Order): OrderDto {
  return {
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    status: order.status.value,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPrice.cents,
      subtotalCents: item.unitPrice.multiply(item.quantity).cents,
    })),
    itemCount: order.itemCount,
    totalCents: order.totalAmount.cents,
    deliveryPerson: order.deliveryPerson,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    transitions: order.transitions(),
  };
}
