import { ValueObject } from '../../../../shared-kernel/domain/index.js';
import { InvalidPasswordHashError } from '../errors/index.js';

/** Mínimo exigido pelo enunciado. */
export const MIN_BCRYPT_COST = 10;

/** `$2a|$2b|$2y` + `$<custo>$` + 53 caracteres (22 de salt + 31 de hash). */
const BCRYPT_PATTERN = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/;

/**
 * Hash bcrypt da senha. O domínio nunca vê a senha em texto puro: o hash é
 * gerado e verificado por um port (PasswordHasher) na camada de aplicação.
 * A invariante garantida aqui é que só entra hash bcrypt com custo ≥ 10.
 */
export class PasswordHash extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static fromHash(hash: string): PasswordHash {
    const match = BCRYPT_PATTERN.exec(hash);
    if (match === null) {
      throw new InvalidPasswordHashError('O hash da senha deve estar no formato bcrypt');
    }
    const cost = Number(match[1]);
    if (cost < MIN_BCRYPT_COST) {
      throw new InvalidPasswordHashError(
        `O hash da senha deve usar no mínimo ${MIN_BCRYPT_COST} salt rounds`,
      );
    }
    return new PasswordHash(hash);
  }

  get value(): string {
    return this.props.value;
  }

  get cost(): number {
    return Number(this.props.value.slice(4, 6));
  }

  /** Nunca expõe o hash em logs ou serializações acidentais. */
  override toString(): string {
    return '[PasswordHash]';
  }

  toJSON(): string {
    return '[PasswordHash]';
  }
}
