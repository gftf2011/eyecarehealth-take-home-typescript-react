import { describe, expect, it } from 'vitest';

import { InvalidUniqueIdError } from './index.js';
import { SampleAggregate as Sample, SampleId } from './testing/sample-aggregate.js';

describe('UniqueId', () => {
  it('gera UUIDs válidos e normaliza para minúsculas', () => {
    const raw = 'A3BB189E-8BF9-3888-9912-ACE4E6543002';
    expect(SampleId.from(raw).value).toBe(raw.toLowerCase());
    expect(SampleId.generate().equals(SampleId.generate())).toBe(false);
  });

  it.each(['', 'not-a-uuid', '123'])('rejeita %j', (raw) => {
    expect(() => SampleId.from(raw)).toThrow(InvalidUniqueIdError);
  });
});

describe('AggregateRoot', () => {
  it('compara entidades pela identidade', () => {
    const id = SampleId.generate();
    expect(Sample.create(id).equals(Sample.create(SampleId.from(id.value)))).toBe(true);
    expect(Sample.create(id).equals(Sample.create(SampleId.generate()))).toBe(false);
  });

  it('acumula eventos e os esvazia ao serem retirados', () => {
    const sample = Sample.create(SampleId.generate());
    sample.touch(1);
    sample.touch(2);

    const events = sample.pullDomainEvents();

    expect(events.map((event) => event.payload)).toEqual([{ value: 1 }, { value: 2 }]);
    expect(sample.domainEvents).toHaveLength(0);
    expect(sample.pullDomainEvents()).toHaveLength(0);
  });

  it('carimba metadados do evento para o outbox', () => {
    const sample = Sample.create(SampleId.generate());
    sample.touch(1);

    const [event] = sample.pullDomainEvents();

    expect(event).toMatchObject({
      eventName: 'test.sample.happened',
      aggregateType: 'test.sample',
      aggregateId: sample.id.value,
      eventVersion: 1,
    });
    expect(event?.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.isFrozen(event?.payload)).toBe(true);
  });
});
