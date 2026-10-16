import type { NumericColumn } from '../../../../shared-kernel/infra/database/numeric';
import type { OutboxDatabase } from '../../../../shared-kernel/infra/outbox/outbox-events.table';
import type { ProductCategoryValue } from '../../../domain';

/** Linha da tabela `products`. */
export interface ProductsTable {
  id: string;
  name: string;
  description: string;
  price: NumericColumn;
  category: ProductCategoryValue;
  image_url: string | null;
  is_available: boolean;
  preparation_time: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * Visões somente leitura das tabelas do Ordering, usadas apenas pela camada
 * anticorrupção. Declaram só as colunas que o Catalog consulta.
 */
export interface OrderingOrdersView {
  id: string;
  status: string;
}

export interface OrderingOrderItemsView {
  order_id: string;
  product_id: string;
}

/** Tabelas visíveis para o Catalog: as próprias, o outbox e as visões da ACL. */
export type CatalogDatabase = OutboxDatabase & {
  products: ProductsTable;
  orders: OrderingOrdersView;
  order_items: OrderingOrderItemsView;
};
