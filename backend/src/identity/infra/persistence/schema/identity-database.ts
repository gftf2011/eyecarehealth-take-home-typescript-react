import type { OutboxDatabase } from '../../../../shared-kernel/infra/outbox/outbox-events.table';
import type { RevocationReason, RoleValue } from '../../../domain';

/** Linha da tabela `users`. */
export interface UsersTable {
  id: string;
  email: string;
  password_hash: string;
  role: RoleValue;
  created_at: Date;
  updated_at: Date;
}

/** Linha da tabela `refresh_sessions`. */
export interface RefreshSessionsTable {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  rotated_at: Date | null;
  revoked_at: Date | null;
  revocation_reason: RevocationReason | null;
}

/** Tabelas visíveis para o Identity: as próprias e o outbox. */
export type IdentityDatabase = OutboxDatabase & {
  users: UsersTable;
  refresh_sessions: RefreshSessionsTable;
};
