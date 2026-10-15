import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { RefreshSessionId } from '../refresh-session-id.js';
import type { RevocationReason } from '../value-objects/revocation-reason.js';
import { REFRESH_SESSION_AGGREGATE_TYPE } from './refresh-session-aggregate-type.js';

export type RefreshSessionRevokedPayload = {
  reason: RevocationReason;
};

export class RefreshSessionRevoked extends DomainEvent<RefreshSessionRevokedPayload> {
  readonly eventName = 'identity.refresh-session.revoked';
  readonly aggregateType = REFRESH_SESSION_AGGREGATE_TYPE;

  constructor(sessionId: RefreshSessionId, occurredAt: Date, payload: RefreshSessionRevokedPayload) {
    super(sessionId.value, occurredAt, payload);
  }
}
