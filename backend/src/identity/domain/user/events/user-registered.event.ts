import { DomainEvent } from '../../../../shared-kernel/domain/index';
import type { UserId } from '../user-id';
import type { RoleValue } from '../value-objects/role';
import { USER_AGGREGATE_TYPE } from './user-aggregate-type';

export type UserRegisteredPayload = {
  email: string;
  role: RoleValue;
};

export class UserRegistered extends DomainEvent<UserRegisteredPayload> {
  readonly eventName = 'identity.user.registered';
  readonly aggregateType = USER_AGGREGATE_TYPE;

  constructor(userId: UserId, occurredAt: Date, payload: UserRegisteredPayload) {
    super(userId.value, occurredAt, payload);
  }
}
