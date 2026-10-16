import type { DeliveryPersonId, Order, OrderStatusValue } from '../../domain';
import type { DeliveryPersonDirectory, DeliveryPersonSummary } from '../ports/delivery-person-directory';

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
  readonly deliveryPerson: DeliveryPersonSummary | null;
  readonly items: readonly OrderItemDto[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** Resumos de entregadores indexados pelo ID, para montar os DTOs. */
export type DeliveryPersonSummaries = ReadonlyMap<string, DeliveryPersonSummary>;

/**
 * Busca, em uma única consulta, os entregadores atribuídos aos pedidos. Todo
 * entregador atribuído existe no Delivery (removidos inclusive); a falta de
 * um indica inconsistência entre os contextos e é tratada como erro.
 */
export async function loadDeliveryPersonSummaries(
  orders: readonly Order[],
  directory: DeliveryPersonDirectory,
): Promise<DeliveryPersonSummaries> {
  const ids = new Map<string, DeliveryPersonId>();
  for (const order of orders) {
    if (order.deliveryPersonId !== null) ids.set(order.deliveryPersonId.value, order.deliveryPersonId);
  }
  if (ids.size === 0) return new Map();

  const summaries = new Map(
    (await directory.summariesOf([...ids.values()])).map((summary) => [summary.id, summary]),
  );
  const missing = [...ids.keys()].filter((id) => !summaries.has(id));
  if (missing.length > 0) {
    throw new Error(`Entregadores atribuídos não encontrados no Delivery: ${missing.join(', ')}`);
  }
  return summaries;
}

export function toOrderDto(order: Order, deliveryPersons: DeliveryPersonSummaries): OrderDto {
  const assigned = order.deliveryPersonId;
  return {
    id: order.id.value,
    customerName: order.customerName.value,
    customerPhone: order.customerPhone.value,
    deliveryAddress: order.deliveryAddress.value,
    latitude: order.location.latitude,
    longitude: order.location.longitude,
    status: order.status.value,
    totalAmount: order.totalAmount.toDecimal(),
    deliveryPerson: assigned === null ? null : (deliveryPersons.get(assigned.value) ?? null),
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
