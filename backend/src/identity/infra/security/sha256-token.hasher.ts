import { createHash } from 'node:crypto';

import type { TokenHasher } from '../../application/ports/token-hasher';
import { TokenHash } from '../../domain';

/** SHA-256 do refresh token: rápido e suficiente para tokens de alta entropia. */
export class Sha256TokenHasher implements TokenHasher {
  hash(token: string): TokenHash {
    return TokenHash.fromHex(createHash('sha256').update(token).digest('hex'));
  }
}
