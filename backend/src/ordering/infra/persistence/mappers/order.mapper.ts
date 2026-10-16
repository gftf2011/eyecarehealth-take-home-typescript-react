import type { Insertable, Selectable } from 'kysely';

import { Money } from '../../../../shared-kernel/domain';
import {
  centsToDecimal,
  decimalToCents,
  toCoordinate,
} from '../../../../shared-kernel/infra/database/numeric';
import {
  CustomerName,
  DeliveryAddress,
  DeliveryPersonId,
  GeoLocation,
  Order,
  OrderId,
  OrderItem,
  OrderItemId,
  OrderStatus,
  PhoneNumber,
  ProductId,
  Quantity,
  StatusChange,
} from '../../../domain';
import type {
  OrderItemsTable,
  OrdersTable,
  OrderStatusHistoryTable,
} from '../schema/ordering-database';

/** Casas decimais das colunas de coordenadas (`numeric(10,8)` / `numeric(11,8)`). */
const COORDINATE_SCALE = 8;

export type OrderRows = {
  readonly order: Insertable<OrdersTable>;
  readonly items: readonly Insertable<OrderItemsTable>[];
  readonly history: readonly Insertable<OrderStatusHistoryTable>[];
};

/**
 * Linhas → agregado. Passa pelos Value Objects: dado inválido no banco falha
 * alto. `items` e `history` devem ser só os do pedido; o histórico é ordenado
 * pela posição aqui, então a ordem da consulta não importa.
 */
export function toOrder(
  row: Selectable<OrdersTable>,
  items: readonly Selectable<OrderItemsTable>[],
  history: readonly Selectable<OrderStatusHistoryTable>[],
): Order {
  return Order.reconstitute(OrderId.from(row.id), {
    customerName: CustomerName.create(row.customer_name),
    customerPhone: PhoneNumber.create(row.customer_phone),
    deliveryAddress: DeliveryAddress.create(row.delivery_address),
    location: GeoLocation.create(toCoordinate(row.latitude), toCoordinate(row.longitude)),
    items: items.map((item) =>
      OrderItem.reconstitute(OrderItemId.from(item.id), {
        productId: ProductId.from(item.product_id),
        productName: item.product_name,
        unitPrice: Money.fromCents(decimalToCents(item.unit_price)),
        quantity: Quantity.of(item.quantity),
      }),
    ),
    status: OrderStatus.create(row.status),
    deliveryPersonId: row.delivery_person_id === null ? null : DeliveryPersonId.from(row.delivery_person_id),
    statusHistory: [...history]
      .sort((a, b) => a.position - b.position)
      .map((change) => StatusChange.record(change.from_status, change.to_status, change.changed_at)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Agregado → linhas das três tabelas. */
export function toOrderRows(order: Order): OrderRows {
  const orderId = order.id.value;
  return {
    order: {
      id: orderId,
      customer_name: order.customerName.value,
      customer_phone: order.customerPhone.value,
      delivery_address: order.deliveryAddress.value,
      latitude: order.location.latitude.toFixed(COORDINATE_SCALE),
      longitude: order.location.longitude.toFixed(COORDINATE_SCALE),
      status: order.status.value,
      total_amount: centsToDecimal(order.totalAmount.cents),
      delivery_person_id: order.deliveryPersonId?.value ?? null,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
    },
    items: order.items.map((item) => ({
      id: item.id.value,
      order_id: orderId,
      product_id: item.productId.value,
      product_name: item.productName,
      quantity: item.quantity.value,
      unit_price: centsToDecimal(item.unitPrice.cents),
    })),
    history: order.statusHistory.map((change, position) => ({
      order_id: orderId,
      position,
      from_status: change.from,
      to_status: change.to,
      changed_at: change.changedAt,
    })),
  };
}
