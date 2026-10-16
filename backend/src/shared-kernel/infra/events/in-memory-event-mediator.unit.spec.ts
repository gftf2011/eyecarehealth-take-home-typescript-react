import { describe, expect, it } from 'vitest';

import type {
  DomainEventHandler,
  EventHandlingScope,
  OutboxMessage,
} from '../../application';
import { DomainEvent } from '../../domain';
import { InMemoryEventMediator } from './in-memory-event-mediator';

const AGGREGATE_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';
const NOW = new Date('2025-01-20T14:30:00Z');

class SomethingHappened extends DomainEvent<{ value: number }> {
  readonly eventName = 'test.sample.something-happened';
  readonly aggregateType = 'sample';

  constructor(value: number) {
    super(AGGREGATE_ID, NOW, { value });
  }
}

class SomethingElseHappened extends DomainEvent<{ label: string }> {
  readonly eventName = 'test.sample.something-else-happened';
  readonly aggregateType = 'sample';

  constructor(label: string) {
    super(AGGREGATE_ID, NOW, { label });
  }
}

class RecordingHandler<TEvent extends DomainEvent> implements DomainEventHandler<TEvent> {
  readonly handled: TEvent[] = [];

  constructor(
    private readonly name: string,
    private readonly log: string[] = [],
  ) {}

  async handle(event: TEvent): Promise<void> {
    this.handled.push(event);
    this.log.push(`${this.name}:${event.eventName}`);
  }
}

function scope(appended: OutboxMessage[] = []): EventHandlingScope {
  return { outbox: { append: async (messages) => void appended.push(...messages) } };
}

describe('InMemoryEventMediator', () => {
  it('entrega cada evento só aos handlers inscritos no seu tipo', async () => {
    const onSomething = new RecordingHandler<SomethingHappened>('a');
    const onSomethingElse = new RecordingHandler<SomethingElseHappened>('b');
    const mediator = new InMemoryEventMediator()
      .subscribe(SomethingHappened, onSomething)
      .subscribe(SomethingElseHappened, onSomethingElse);

    const first = new SomethingHappened(1);
    const second = new SomethingElseHappened('x');
    await mediator.publish([first, second], scope());

    expect(onSomething.handled).toEqual([first]);
    expect(onSomethingElse.handled).toEqual([second]);
  });

  it('chama vários handlers do mesmo evento em sequência, na ordem de inscrição', async () => {
    const log: string[] = [];
    const mediator = new InMemoryEventMediator()
      .subscribe(SomethingHappened, new RecordingHandler('first', log))
      .subscribe(SomethingElseHappened, new RecordingHandler('other', log))
      .subscribe(SomethingHappened, new RecordingHandler('second', log));

    await mediator.publish([new SomethingHappened(1), new SomethingElseHappened('x')], scope());

    expect(log).toEqual([
      'first:test.sample.something-happened',
      'second:test.sample.something-happened',
      'other:test.sample.something-else-happened',
    ]);
  });

  it('descarta eventos sem handler', async () => {
    await expect(
      new InMemoryEventMediator().publish([new SomethingHappened(1)], scope()),
    ).resolves.toBeUndefined();
  });

  it('o handler decide o payload da mensagem gravada no outbox', async () => {
    const appended: OutboxMessage[] = [];
    const mediator = new InMemoryEventMediator().subscribe(SomethingHappened, {
      handle: async (event, { outbox }) =>
        outbox.append([
          {
            id: event.eventId,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            eventName: 'partner.sample.notified',
            eventVersion: 1,
            payload: { doubled: event.payload.value * 2 },
            occurredAt: event.occurredAt,
          },
        ]),
    });

    const event = new SomethingHappened(21);
    await mediator.publish([event], scope(appended));

    expect(appended).toEqual([
      {
        id: event.eventId,
        aggregateType: 'sample',
        aggregateId: AGGREGATE_ID,
        eventName: 'partner.sample.notified',
        eventVersion: 1,
        payload: { doubled: 42 },
        occurredAt: NOW,
      },
    ]);
  });

  it('para no primeiro erro de handler e o propaga (a transação é desfeita)', async () => {
    const failure = new Error('handler falhou');
    const after = new RecordingHandler<SomethingHappened>('after');
    const mediator = new InMemoryEventMediator()
      .subscribe(SomethingHappened, {
        handle: async () => {
          throw failure;
        },
      })
      .subscribe(SomethingHappened, after);

    await expect(mediator.publish([new SomethingHappened(1)], scope())).rejects.toBe(failure);
    expect(after.handled).toHaveLength(0);
  });
});
