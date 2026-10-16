import type { UnitOfWork } from '../../../shared-kernel/application';
import type { RefreshSessionRepository, UserRepository } from '../../domain';

/** Repositórios do Identity disponíveis dentro de uma transação. */
export type IdentityRepositories = {
  readonly users: UserRepository;
  readonly sessions: RefreshSessionRepository;
};

export type IdentityUnitOfWork = UnitOfWork<IdentityRepositories>;
