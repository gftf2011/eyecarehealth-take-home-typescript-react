import { DomainEvent } from '../../../../shared-kernel/domain';
import type { RefreshSessionId } from '../refresh-session-id';
import { REFRESH_SESSION_AGGREGATE_TYPE } from './refresh-session-aggregate-type';

export type RefreshSessionRotatedPayload = {
  expiresAt: string;
};

export class RefreshSessionRotated extends DomainEvent<RefreshSessionRotatedPayload> {
  readonly eventName = 'identity.refresh-session.rotated';
  readonly aggregateType = REFRESH_SESSION_AGGREGATE_TYPE;

  constructor(sessionId: RefreshSessionId, occurredAt: Date, payload: RefreshSessionRotatedPayload) {
    super(sessionId.value, occurredAt, payload);
  }
}
