import type { UserPasswordChanged } from './user-password-changed.event';
import type { UserRegistered } from './user-registered.event';
import type { UserRoleChanged } from './user-role-changed.event';

export { USER_AGGREGATE_TYPE } from './user-aggregate-type';
export { UserPasswordChanged } from './user-password-changed.event';
export { UserRegistered, type UserRegisteredPayload } from './user-registered.event';
export { UserRoleChanged, type UserRoleChangedPayload } from './user-role-changed.event';

export type UserDomainEvent = UserRegistered | UserRoleChanged | UserPasswordChanged;
