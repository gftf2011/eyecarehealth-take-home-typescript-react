import type { NumericColumn } from '../../../../shared-kernel/infra/database/numeric';
import type { OutboxDatabase } from '../../../../shared-kernel/infra/outbox/outbox-events.table';
import type { VehicleTypeValue } from '../../../domain';

/** Linha da tabela `delivery_persons`. */
export interface DeliveryPersonsTable {
  id: string;
  name: string;
  phone: string;
  vehicle_type: VehicleTypeValue;
  is_active: boolean;
  current_latitude: NumericColumn | null;
  current_longitude: NumericColumn | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * Visão somente leitura da tabela `orders` do Ordering, usada apenas pela
 * camada anticorrupção. Declara só as colunas que o Delivery consulta.
 */
export interface OrderingOrdersView {
  id: string;
  status: string;
  delivery_address: string;
  latitude: NumericColumn;
  longitude: NumericColumn;
  delivery_person_id: string | null;
  created_at: Date;
}

/** Tabelas visíveis para o Delivery: as próprias, o outbox e a visão da ACL. */
export type DeliveryDatabase = OutboxDatabase & {
  delivery_persons: DeliveryPersonsTable;
  orders: OrderingOrdersView;
};
