import { DomainEvent } from '../../../../shared-kernel/domain/index';
import type { UserId } from '../user-id';
import { USER_AGGREGATE_TYPE } from './user-aggregate-type';

/** Sem payload: o hash nunca sai do agregado. */
export class UserPasswordChanged extends DomainEvent<Record<string, never>> {
  readonly eventName = 'identity.user.password-changed';
  readonly aggregateType = USER_AGGREGATE_TYPE;

  constructor(userId: UserId, occurredAt: Date) {
    super(userId.value, occurredAt, {});
  }
}
