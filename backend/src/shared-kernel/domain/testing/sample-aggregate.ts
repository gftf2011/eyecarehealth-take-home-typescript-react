import { AggregateRoot, DomainEvent, Entity, UniqueId } from '../index';

/**
 * Agregado mínimo para exercitar as bases do shared kernel sem depender de
 * nenhum bounded context.
 */
export class SampleId extends UniqueId {
  declare private readonly brand: 'SampleId';

  static generate(): SampleId {
    return new SampleId(UniqueId.newUuid());
  }

  static from(raw: string): SampleId {
    return new SampleId(raw);
  }
}

export class SampleLineId extends UniqueId {
  declare private readonly brand: 'SampleLineId';

  static generate(): SampleLineId {
    return new SampleLineId(UniqueId.newUuid());
  }
}

export const SAMPLE_OCCURRED_AT = new Date('2025-01-01T00:00:00Z');

export class SampleHappened extends DomainEvent<{ value: number }> {
  readonly eventName = 'test.sample.happened';
  readonly aggregateType = 'test.sample';

  constructor(id: SampleId, value: number) {
    super(id.value, SAMPLE_OCCURRED_AT, { value });
  }
}

export class SampleAggregate extends AggregateRoot<SampleId> {
  static create(id: SampleId): SampleAggregate {
    return new SampleAggregate(id);
  }

  touch(value: number): void {
    this.addDomainEvent(new SampleHappened(this.id, value));
  }
}

/** Entidade interna (não raiz) do agregado de exemplo. */
export class SampleLine extends Entity<SampleLineId> {}
