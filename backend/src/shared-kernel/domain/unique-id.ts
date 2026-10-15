import { randomUUID } from 'node:crypto';

import { InvalidUniqueIdError } from './errors/invalid-unique-id.error.js';
import { ValueObject } from './value-object.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Identificador UUID. Cada agregado declara a própria subclasse (ex.: ProductId)
 * com uma marca nominal, para que IDs de agregados diferentes não sejam
 * intercambiáveis em tempo de compilação.
 */
export abstract class UniqueId extends ValueObject<{ value: string }> {
  protected constructor(value: string, field = 'id') {
    if (!UUID_PATTERN.test(value)) throw new InvalidUniqueIdError(field, value);
    super({ value: value.toLowerCase() });
  }

  protected static newUuid(): string {
    return randomUUID();
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
