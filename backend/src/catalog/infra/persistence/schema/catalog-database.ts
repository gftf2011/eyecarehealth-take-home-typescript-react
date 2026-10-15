import type { ColumnType } from 'kysely';

import type { OutboxDatabase } from '../../../../shared-kernel/infra/outbox/outbox-events.table';
import type { ProductCategoryValue } from '../../../domain';

/** Linha da tabela `products`. */
export interface ProductsTable {
  id: string;
  name: string;
  description: string;
  /** `numeric(10,2)`: o driver `pg` devolve como string para não perder precisão. */
  price: ColumnType<string, string, string>;
  category: ProductCategoryValue;
  image_url: string | null;
  is_available: boolean;
  preparation_time: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/** Tabelas visíveis para o Catalog: as próprias e o outbox. */
export type CatalogDatabase = OutboxDatabase & {
  products: ProductsTable;
};
