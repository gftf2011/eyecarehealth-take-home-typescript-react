import { AggregateRoot } from '../../../shared-kernel/domain/index.js';
import { UserPasswordChanged, UserRegistered, UserRoleChanged } from './events/index.js';
import type { UserId } from './user-id.js';
import type { Email } from './value-objects/email.js';
import type { PasswordHash } from './value-objects/password-hash.js';
import type { Permission } from './value-objects/permission.js';
import type { Role } from './value-objects/role.js';

export type RegisterUserParams = {
  id: UserId;
  email: Email;
  passwordHash: PasswordHash;
  role: Role;
  now: Date;
};

export type UserSnapshot = {
  email: Email;
  passwordHash: PasswordHash;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Raiz do agregado User (contexto Identity): um operador do painel.
 *
 * Invariantes:
 * - Email válido e normalizado; unicidade garantida pela aplicação + índice único.
 * - Senha só existe como hash bcrypt com custo ≥ 10 (ver PasswordHash).
 * - Papel define as permissões (ver Role).
 */
export class User extends AggregateRoot<UserId> {
  #state: UserSnapshot;

  private constructor(id: UserId, state: UserSnapshot) {
    super(id);
    this.#state = state;
  }

  static register({ id, email, passwordHash, role, now }: RegisterUserParams): User {
    const user = new User(id, {
      email,
      passwordHash,
      role,
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
    });
    user.addDomainEvent(new UserRegistered(id, now, { email: email.value, role: role.value }));
    return user;
  }

  /** Reidrata a partir da persistência. Não emite eventos. */
  static reconstitute(id: UserId, snapshot: UserSnapshot): User {
    return new User(id, { ...snapshot });
  }

  get email(): Email {
    return this.#state.email;
  }

  get passwordHash(): PasswordHash {
    return this.#state.passwordHash;
  }

  get role(): Role {
    return this.#state.role;
  }

  get createdAt(): Date {
    return new Date(this.#state.createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.#state.updatedAt.getTime());
  }

  snapshot(): UserSnapshot {
    return { ...this.#state, createdAt: this.createdAt, updatedAt: this.updatedAt };
  }

  can(permission: Permission): boolean {
    return this.#state.role.can(permission);
  }

  changeRole(role: Role, now: Date): void {
    const previous = this.#state.role;
    if (previous.equals(role)) return;

    this.#state = { ...this.#state, role, updatedAt: new Date(now.getTime()) };
    this.addDomainEvent(new UserRoleChanged(this.id, now, { from: previous.value, to: role.value }));
  }

  changePassword(passwordHash: PasswordHash, now: Date): void {
    if (this.#state.passwordHash.equals(passwordHash)) return;

    this.#state = { ...this.#state, passwordHash, updatedAt: new Date(now.getTime()) };
    this.addDomainEvent(new UserPasswordChanged(this.id, now));
  }
}
