import {
  Email,
  PasswordHash,
  Role,
  User,
  UserId,
  type RegisterUserParams,
} from '../../index';

export const REGISTERED_AT = new Date('2025-01-01T08:00:00Z');
export const LATER = new Date('2025-01-02T08:00:00Z');

/** Hashes no formato bcrypt (não correspondem a senhas reais). */
export const BCRYPT_COST_10 = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
export const BCRYPT_COST_12 = '$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export function buildRegisterUserParams(overrides: Partial<RegisterUserParams> = {}): RegisterUserParams {
  return {
    id: UserId.generate(),
    email: Email.create('admin@fastmeals.com'),
    passwordHash: PasswordHash.fromHash(BCRYPT_COST_10),
    role: Role.of('admin'),
    now: REGISTERED_AT,
    ...overrides,
  };
}

/** Usuário recém-cadastrado, já sem o evento de cadastro. */
export function buildUser(overrides: Partial<RegisterUserParams> = {}): User {
  const user = User.register(buildRegisterUserParams(overrides));
  user.pullDomainEvents();
  return user;
}
