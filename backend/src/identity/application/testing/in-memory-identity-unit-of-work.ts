import type { DomainEvent } from '../../../shared-kernel/domain';
import {
  RefreshSession,
  RefreshSessionId,
  User,
  UserId,
  type Email,
  type RefreshSessionRepository,
  type RefreshSessionSnapshot,
  type UserRepository,
  type UserSnapshot,
} from '../../domain';
import type { IdentityRepositories, IdentityUnitOfWork } from '../ports/identity-unit-of-work';

/**
 * Unit of work em memória com commit/rollback reais (mesma semântica do fake
 * do Catalog): escritas ficam em área temporária até o fim da transação.
 */
export class InMemoryIdentityUnitOfWork implements IdentityUnitOfWork {
  readonly users = new Map<string, UserSnapshot>();
  readonly sessions = new Map<string, RefreshSessionSnapshot>();
  readonly outbox: DomainEvent[] = [];
  commits = 0;
  rollbacks = 0;

  givenUsers(...users: User[]): void {
    for (const user of users) {
      user.pullDomainEvents();
      this.users.set(user.id.value, user.snapshot());
    }
  }

  givenSessions(...sessions: RefreshSession[]): void {
    for (const session of sessions) {
      session.pullDomainEvents();
      this.sessions.set(session.id.value, session.snapshot());
    }
  }

  committedSession(id: string): RefreshSession | undefined {
    const snapshot = this.sessions.get(id);
    return snapshot === undefined
      ? undefined
      : RefreshSession.reconstitute(RefreshSessionId.from(id), snapshot);
  }

  async transaction<TResult>(
    work: (repositories: IdentityRepositories) => Promise<TResult>,
  ): Promise<TResult> {
    const stagedUsers = new Map<string, UserSnapshot>();
    const stagedSessions = new Map<string, RefreshSessionSnapshot>();
    const stagedEvents: DomainEvent[] = [];

    try {
      const result = await work({
        users: new InMemoryUserRepository(this.users, stagedUsers, stagedEvents),
        sessions: new InMemoryRefreshSessionRepository(this.sessions, stagedSessions, stagedEvents),
      });
      for (const [id, snapshot] of stagedUsers) this.users.set(id, snapshot);
      for (const [id, snapshot] of stagedSessions) this.sessions.set(id, snapshot);
      this.outbox.push(...stagedEvents);
      this.commits += 1;
      return result;
    } catch (error) {
      this.rollbacks += 1;
      throw error;
    }
  }
}

class InMemoryUserRepository implements UserRepository {
  constructor(
    private readonly committed: ReadonlyMap<string, UserSnapshot>,
    private readonly staged: Map<string, UserSnapshot>,
    private readonly stagedEvents: DomainEvent[],
  ) {}

  async findById(id: UserId): Promise<User | null> {
    const snapshot = this.staged.get(id.value) ?? this.committed.get(id.value);
    return snapshot === undefined ? null : User.reconstitute(id, snapshot);
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const [id, snapshot] of new Map([...this.committed, ...this.staged])) {
      if (snapshot.email.equals(email)) return User.reconstitute(UserId.from(id), snapshot);
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.staged.set(user.id.value, user.snapshot());
    this.stagedEvents.push(...user.pullDomainEvents());
  }
}

class InMemoryRefreshSessionRepository implements RefreshSessionRepository {
  constructor(
    private readonly committed: ReadonlyMap<string, RefreshSessionSnapshot>,
    private readonly staged: Map<string, RefreshSessionSnapshot>,
    private readonly stagedEvents: DomainEvent[],
  ) {}

  async findById(id: RefreshSessionId): Promise<RefreshSession | null> {
    const snapshot = this.staged.get(id.value) ?? this.committed.get(id.value);
    return snapshot === undefined ? null : RefreshSession.reconstitute(id, snapshot);
  }

  async save(session: RefreshSession): Promise<void> {
    this.staged.set(session.id.value, session.snapshot());
    this.stagedEvents.push(...session.pullDomainEvents());
  }
}
