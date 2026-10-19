import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Clock } from '../../application';
import type { OutboxRelayCycle, RelayBatchResult } from './outbox-relay';
import { OutboxRelayRunner, type OutboxRelayRunnerOptions } from './outbox-relay.runner';

const POLL_MS = 100;
const BATCH = 10;

/** Relógio sobre `Date.now()`, que os fake timers do Vitest controlam. */
const clock: Clock = { now: () => new Date(Date.now()) };

class FakeCycle implements OutboxRelayCycle {
  /** Instante (ms) de cada chamada a `relayBatch`. */
  readonly batchCalls: number[] = [];
  readonly purges: Date[] = [];
  next: () => Promise<RelayBatchResult> = async () => ({ published: 0, failed: 0 });

  /** Tamanhos de lote pedidos pelo loop (conferidos pelos testes). */
  readonly limits: number[] = [];

  async relayBatch(limit: number): Promise<RelayBatchResult> {
    this.limits.push(limit);
    this.batchCalls.push(Date.now());
    return this.next();
  }

  async purgePublishedBefore(instant: Date): Promise<number> {
    this.purges.push(instant);
    return 0;
  }
}

describe('OutboxRelayRunner', () => {
  let cycle: FakeCycle;
  let errors: unknown[];
  let runner: OutboxRelayRunner;
  const startedAt = new Date('2025-01-20T12:00:00Z').getTime();

  function build(overrides: Partial<OutboxRelayRunnerOptions> = {}): OutboxRelayRunner {
    return new OutboxRelayRunner(cycle, {
      batchSize: BATCH,
      pollIntervalMs: POLL_MS,
      maxBackoffMs: 1_000,
      clock,
      onError: (error) => errors.push(error),
      ...overrides,
    });
  }

  /** Instantes das chamadas, relativos ao início. */
  const offsets = (): number[] => cycle.batchCalls.map((at) => at - startedAt);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(startedAt);
    cycle = new FakeCycle();
    errors = [];
    runner = build();
  });

  afterEach(async () => {
    const stopping = runner.stop();
    await vi.runAllTimersAsync();
    await stopping;
    vi.useRealTimers();
  });

  it('sem pendentes, espera o intervalo de polling entre ciclos', async () => {
    runner.start();

    await vi.advanceTimersByTimeAsync(250);

    expect(offsets()).toEqual([0, 100, 200]);
    expect(cycle.limits).toEqual([BATCH, BATCH, BATCH]);
  });

  it('com lote cheio, emenda o próximo sem esperar', async () => {
    let full = 3;
    cycle.next = async () => ({ published: full-- > 0 ? BATCH : 2, failed: 0 });
    runner.start();

    await vi.advanceTimersByTimeAsync(50);

    // 3 lotes cheios seguidos, depois um parcial: só então espera.
    expect(offsets()).toEqual([0, 0, 0, 0]);
  });

  it('falha ao publicar: backoff exponencial até o teto, e volta ao normal quando recupera', async () => {
    let failures = 5;
    cycle.next = async () => (failures-- > 0 ? { published: 0, failed: 1 } : { published: 0, failed: 0 });
    runner.start();

    await vi.advanceTimersByTimeAsync(5_000);

    // Esperas: 200, 400, 800, 1000 (teto), 1000; depois o polling normal de 100.
    expect(offsets().slice(0, 8)).toEqual([0, 200, 600, 1_400, 2_400, 3_400, 3_500, 3_600]);
  });

  it('erro no ciclo (ex.: banco fora): reporta, faz backoff e continua', async () => {
    const failure = new Error('banco fora do ar');
    let attempts = 0;
    cycle.next = async () => {
      attempts += 1;
      if (attempts === 1) throw failure;
      return { published: 0, failed: 0 };
    };
    runner.start();

    await vi.advanceTimersByTimeAsync(300);

    expect(errors).toEqual([failure]);
    expect(offsets()).toEqual([0, 200, 300]);
  });

  it('stop() espera o lote em andamento terminar e não inicia outro', async () => {
    let finish: (result: RelayBatchResult) => void = () => undefined;
    cycle.next = () => new Promise((resolve) => (finish = resolve));
    runner.start();
    await vi.advanceTimersByTimeAsync(0);

    let stopped = false;
    const stopping = runner.stop().then(() => (stopped = true));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(stopped).toBe(false);

    finish({ published: 1, failed: 0 });
    await stopping;
    expect(stopped).toBe(true);
    expect(cycle.batchCalls).toHaveLength(1);
  });

  it('stop() acorda o loop durante a espera, sem aguardar o intervalo', async () => {
    runner = build({ pollIntervalMs: 60_000 });
    runner.start();
    await vi.advanceTimersByTimeAsync(0);

    await runner.stop();

    expect(cycle.batchCalls).toHaveLength(1);
  });

  it('remove entregues antigas no início e depois a cada purgeEveryMs', async () => {
    runner = build({ purgeEveryMs: 1_000, retentionMs: 7 * 24 * 60 * 60 * 1000 });
    runner.start();

    await vi.advanceTimersByTimeAsync(1_050);

    expect(cycle.purges.map((instant) => instant.toISOString())).toEqual([
      '2025-01-13T12:00:00.000Z',
      '2025-01-13T12:00:01.000Z',
    ]);
  });

  it('isAlive: vivo enquanto conclui ciclos recentes; morto parado ou travado', async () => {
    expect(runner.isAlive(1_000)).toBe(false);

    runner.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.isAlive(1_000)).toBe(true);

    // Ciclo travado: nenhum ciclo conclui por mais que o limite.
    let release: (result: RelayBatchResult) => void = () => undefined;
    cycle.next = () => new Promise((resolve) => (release = resolve));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(runner.isAlive(1_000)).toBe(false);

    // Libera o ciclo para o stop() do afterEach poder concluir.
    release({ published: 0, failed: 0 });
  });
});
