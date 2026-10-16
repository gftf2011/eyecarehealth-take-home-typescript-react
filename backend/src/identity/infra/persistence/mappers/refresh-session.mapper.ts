import type { Insertable, Selectable } from 'kysely';

import { RefreshSession, RefreshSessionId, TokenHash, UserId } from '../../../domain';
import type { RefreshSessionsTable } from '../schema/identity-database';

export function toRefreshSession(row: Selectable<RefreshSessionsTable>): RefreshSession {
  return RefreshSession.reconstitute(RefreshSessionId.from(row.id), {
    userId: UserId.from(row.user_id),
    tokenHash: TokenHash.fromHex(row.token_hash),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at,
    revokedAt: row.revoked_at,
    revocationReason: row.revocation_reason,
  });
}

export function toRefreshSessionRow(session: RefreshSession): Insertable<RefreshSessionsTable> {
  const snapshot = session.snapshot();
  return {
    id: session.id.value,
    user_id: snapshot.userId.value,
    token_hash: snapshot.tokenHash.value,
    expires_at: snapshot.expiresAt,
    created_at: snapshot.createdAt,
    rotated_at: snapshot.rotatedAt,
    revoked_at: snapshot.revokedAt,
    revocation_reason: snapshot.revocationReason,
  };
}
