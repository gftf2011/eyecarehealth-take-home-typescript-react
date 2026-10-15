import { DomainEvent } from '../../../../shared-kernel/domain/index';
import type { RefreshSessionId } from '../refresh-session-id';
import { REFRESH_SESSION_AGGREGATE_TYPE } from './refresh-session-aggregate-type';

export type RefreshSessionStartedPayload = {
  userId: string;
  expiresAt: string;
};

export class RefreshSessionStarted extends DomainEvent<RefreshSessionStartedPayload> {
  readonly eventName = 'identity.refresh-session.started';
  readonly aggregateType = REFRESH_SESSION_AGGREGATE_TYPE;

  constructor(sessionId: RefreshSessionId, occurredAt: Date, payload: RefreshSessionStartedPayload) {
    super(sessionId.value, occurredAt, payload);
  }
}
