import type { NumericColumn } from '../../../../shared-kernel/infra/database/numeric';
import type { OutboxDatabase } from '../../../../shared-kernel/infra/outbox/outbox-events.table';
import type { DeliveryIssueReasonValue, DeliveryIssueResolution, OrderStatusValue } from '../../../domain';

/** Linha da tabela `orders`. */
export interface OrdersTable {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  latitude: NumericColumn;
  longitude: NumericColumn;
  status: OrderStatusValue;
  total_amount: NumericColumn;
  delivery_person_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Linha da tabela `order_items`. */
export interface OrderItemsTable {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: NumericColumn;
}

/** Linha da tabela `order_status_history`. */
export interface OrderStatusHistoryTable {
  order_id: string;
  position: number;
  from_status: OrderStatusValue | null;
  to_status: OrderStatusValue;
  changed_at: Date;
  /** Só nas transições que exigem motivo (entrega devolvida para a atribuição). */
  reason: string | null;
}

/** Linha da tabela `order_delivery_issues`. */
export interface OrderDeliveryIssuesTable {
  id: string;
  order_id: string;
  reason: DeliveryIssueReasonValue;
  note: string | null;
  reported_by: string;
  reported_at: Date;
  resolved_at: Date | null;
  resolution: DeliveryIssueResolution | null;
}

/**
 * Visões somente leitura de tabelas de outros contextos, usadas apenas pelas
 * camadas anticorrupção. Declaram só as colunas que o Ordering consulta.
 */
export interface CatalogProductsView {
  id: string;
  name: string;
  price: NumericColumn;
  is_available: boolean;
  deleted_at: Date | null;
}

export interface DeliveryPersonsView {
  id: string;
  name: string;
  is_active: boolean;
  /** Login do entregador (perfil `courier`), para as rotas `/api/me/...`. */
  user_id: string | null;
  deleted_at: Date | null;
}

/** Tabelas visíveis para o Ordering: as próprias, o outbox e as visões das ACLs. */
export type OrderingDatabase = OutboxDatabase & {
  orders: OrdersTable;
  order_items: OrderItemsTable;
  order_status_history: OrderStatusHistoryTable;
  order_delivery_issues: OrderDeliveryIssuesTable;
  products: CatalogProductsView;
  delivery_persons: DeliveryPersonsView;
};
