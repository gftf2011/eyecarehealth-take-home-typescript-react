import type { NumericColumn } from '../../../../shared-kernel/infra/database/numeric';

/**
 * O Reporting não tem tabelas próprias: lê as dos outros contextos, sempre
 * em consultas agregadas e somente leitura. Cada visão declara só as colunas
 * que os relatórios usam.
 */
export interface OrdersView {
  id: string;
  status: string;
  total_amount: NumericColumn;
  delivery_person_id: string | null;
  created_at: Date;
}

export interface OrderItemsView {
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: NumericColumn;
}

export interface OrderStatusHistoryView {
  order_id: string;
  to_status: string;
  changed_at: Date;
}

export interface ProductsView {
  id: string;
  name: string;
}

export interface DeliveryPersonsView {
  id: string;
  vehicle_type: string;
}

export type ReportingDatabase = {
  orders: OrdersView;
  order_items: OrderItemsView;
  order_status_history: OrderStatusHistoryView;
  products: ProductsView;
  delivery_persons: DeliveryPersonsView;
};
