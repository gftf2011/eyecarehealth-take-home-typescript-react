import { hash, verify } from '@node-rs/bcrypt';

import type { PasswordHasher } from '../../application/ports/password-hasher';
import { MIN_BCRYPT_COST, PasswordHash } from '../../domain';

/**
 * bcrypt nativo (Rust via N-API): o hash roda no thread pool, sem bloquear o
 * event loop — logins simultâneos não travam as demais requisições.
 */
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly cost: number = MIN_BCRYPT_COST) {
    if (cost < MIN_BCRYPT_COST) {
      throw new RangeError(`O custo do bcrypt deve ser no mínimo ${MIN_BCRYPT_COST}`);
    }
  }

  async hash(plainPassword: string): Promise<PasswordHash> {
    return PasswordHash.fromHash(await hash(plainPassword, { cost: this.cost }));
  }

  async verify(plainPassword: string, passwordHash: PasswordHash): Promise<boolean> {
    return verify(plainPassword, passwordHash.value);
  }
}
