import type { OutboxDatabase } from '../../../../shared-kernel/infra/outbox/outbox-events.table';
import type { NumericColumn } from '../../../../shared-kernel/infra/database/numeric';
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

/** Tabelas visíveis para o Delivery: as próprias e o outbox. */
export type DeliveryDatabase = OutboxDatabase & {
  delivery_persons: DeliveryPersonsTable;
};
