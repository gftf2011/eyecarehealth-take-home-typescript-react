import type { TokenHash } from '../../domain';

/** Hash determinístico do refresh token: só o hash é persistido. */
export interface TokenHasher {
  hash(token: string): TokenHash;
}
