import { ValueObject } from '../../../../shared-kernel/domain/index.js';
import { InvalidTokenHashError } from '../errors/index.js';

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/**
 * SHA-256 (hex) do refresh token. Só o hash é persistido: um vazamento do
 * banco não entrega tokens utilizáveis. O cálculo do hash é feito na infra.
 */
export class TokenHash extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static fromHex(hex: string): TokenHash {
    const value = hex.toLowerCase();
    if (!SHA256_HEX_PATTERN.test(value)) {
      throw new InvalidTokenHashError('O hash do token deve ser um SHA-256 em hexadecimal');
    }
    return new TokenHash(value);
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return '[TokenHash]';
  }

  toJSON(): string {
    return '[TokenHash]';
  }
}
