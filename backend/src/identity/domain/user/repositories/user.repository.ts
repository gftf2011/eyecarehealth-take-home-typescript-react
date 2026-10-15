import type { Repository } from '../../../../shared-kernel/domain/index';
import type { User } from '../user';
import type { Email } from '../value-objects/email';

/** Repositório do agregado User. */
export interface UserRepository extends Repository<User> {
  /** Busca para o login; o email já chega normalizado pelo VO. */
  findByEmail(email: Email): Promise<User | null>;
}
