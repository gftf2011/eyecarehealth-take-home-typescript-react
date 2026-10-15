import type { UserPasswordChanged } from './user-password-changed.event.js';
import type { UserRegistered } from './user-registered.event.js';
import type { UserRoleChanged } from './user-role-changed.event.js';

export { USER_AGGREGATE_TYPE } from './user-aggregate-type.js';
export { UserPasswordChanged } from './user-password-changed.event.js';
export { UserRegistered, type UserRegisteredPayload } from './user-registered.event.js';
export { UserRoleChanged, type UserRoleChangedPayload } from './user-role-changed.event.js';

export type UserDomainEvent = UserRegistered | UserRoleChanged | UserPasswordChanged;
