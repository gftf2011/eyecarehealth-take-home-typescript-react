import { DomainEvent } from '../../../../shared-kernel/domain';
import type { UserId } from '../user-id';
import type { RoleValue } from '../value-objects/role';
import { USER_AGGREGATE_TYPE } from './user-aggregate-type';

export type UserRoleChangedPayload = {
  from: RoleValue;
  to: RoleValue;
};

export class UserRoleChanged extends DomainEvent<UserRoleChangedPayload> {
  readonly eventName = 'identity.user.role-changed';
  readonly aggregateType = USER_AGGREGATE_TYPE;

  constructor(userId: UserId, occurredAt: Date, payload: UserRoleChangedPayload) {
    super(userId.value, occurredAt, payload);
  }
}
