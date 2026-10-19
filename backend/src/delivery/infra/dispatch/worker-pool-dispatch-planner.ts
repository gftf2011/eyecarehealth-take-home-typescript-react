import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { DispatchPlannerBusyError } from '../../application/errors/dispatch-planner-busy.error';
import { DispatchPlannerTimeoutError } from '../../application/errors/dispatch-planner-timeout.error';
import type { DispatchPlanner, PlannedAssignment } from '../../application/ports/dispatch-planner';
import type { DispatchableOrder, DispatchCandidate } from '../../domain';
import { fromWirePlan, toWireCandidates, toWireOrders, type WireRequest, type WorkerMessage } from './dispatch-wire';

export type WorkerPoolDispatchPlannerOptions = {
  /** Workers no pool: cálculos ao mesmo tempo. */
  readonly size: number;
  /** Pedidos esperando um worker livre; além disso, recusa na hora (503). */
  readonly maxQueued: number;
  /** Tempo máximo de um cálculo; o worker é encerrado e recriado. */
  readonly timeoutMs: number;
  /** Script do worker; padrão: o bundle irmão ou o `.ts` (testes de falha de boot). */
  readonly script?: URL;
};

type Job = {
  readonly request: Omit<WireRequest, 'id'>;
  readonly resolve: (result: PlannedAssignment) => void;
  readonly reject: (error: unknown) => void;
};

/** `ready`: o worker terminou de carregar; até lá, não recebe cálculos. */
type Slot = { worker: Worker; ready: boolean; job: (Job & { id: number; timer: NodeJS.Timeout }) | null };

/** Workers que morrem antes de carregar, seguidos: o script não sobe (build quebrado). */
const MAX_BOOT_FAILURES = 3;

/**
 * Onde está o código do worker: no build (`dist/`), o bundle irmão
 * `dispatch-planner.worker.js`; rodando do código-fonte (tsx, Vitest), o
 * `.ts`, carregado pelo loader do tsx.
 */
function workerScript(): { url: URL; execArgv: string[] } {
  const bundled = new URL('./dispatch-planner.worker.js', import.meta.url);
  if (existsSync(fileURLToPath(bundled))) return { url: bundled, execArgv: [] };
  return { url: new URL('./dispatch-planner.worker.ts', import.meta.url), execArgv: ['--import', 'tsx'] };
}

/**
 * Roda o otimizador num pool de `worker_threads`: a thread da API continua
 * atendendo login, listagens e health check durante um cálculo grande.
 *
 * - **Fila limitada:** com todos ocupados, até `maxQueued` esperam; além
 *   disso, `DispatchPlannerBusyError` (503) na hora, em vez de empilhar
 *   trabalho de CPU que ninguém vai esperar.
 * - **Timeout:** um cálculo que passa de `timeoutMs` derruba o worker (não há
 *   como interromper código síncrono de outro jeito), que é recriado.
 * - Um worker que morre por qualquer motivo também é recriado; o cálculo em
 *   andamento falha.
 * - Um worker só recebe cálculo depois de avisar que carregou: o timeout mede
 *   o cálculo, não o boot (que, rodando do código-fonte, inclui o tsx).
 */
export class WorkerPoolDispatchPlanner implements DispatchPlanner {
  readonly #options: WorkerPoolDispatchPlannerOptions;
  readonly #script: { url: URL; execArgv: string[] };
  readonly #slots: Slot[];
  readonly #queue: Job[] = [];
  readonly #readyWaiters: { resolve: () => void; reject: (error: unknown) => void }[] = [];
  #nextId = 1;
  #closed = false;
  #bootFailures = 0;
  /** O worker não consegue nem carregar: o pool para de tentar e falha tudo. */
  #broken: Error | null = null;

  constructor(options: WorkerPoolDispatchPlannerOptions) {
    this.#options = options;
    this.#script = options.script === undefined ? workerScript() : { url: options.script, execArgv: [] };
    this.#slots = Array.from({ length: Math.max(1, options.size) }, () => ({ worker: this.#spawn(), ready: false, job: null }));
  }

  /**
   * Resolve quando todos os workers carregaram (aquecimento no boot e testes);
   * rejeita se o worker não conseguir subir.
   */
  ready(): Promise<void> {
    if (this.#broken !== null) return Promise.reject(this.#broken);
    if (this.#slots.every((slot) => slot.ready)) return Promise.resolve();
    return new Promise((resolve, reject) => this.#readyWaiters.push({ resolve, reject }));
  }

  plan(orders: readonly DispatchableOrder[], candidates: readonly DispatchCandidate[]): Promise<PlannedAssignment> {
    if (this.#broken !== null) return Promise.reject(this.#broken);
    if (this.#closed) return Promise.reject(new DispatchPlannerBusyError());
    const request = { orders: toWireOrders(orders), candidates: toWireCandidates(candidates) };
    return new Promise<PlannedAssignment>((resolve, reject) => {
      const job: Job = { request, resolve, reject };
      const free = this.#slots.find((slot) => slot.ready && slot.job === null);
      if (free !== undefined) {
        this.#run(free, job);
        return;
      }
      if (this.#queue.length >= this.#options.maxQueued) {
        reject(new DispatchPlannerBusyError());
        return;
      }
      this.#queue.push(job);
    });
  }

  /** Cálculos em andamento e na fila (observabilidade e testes). */
  get load(): { readonly running: number; readonly queued: number } {
    return { running: this.#slots.filter((slot) => slot.job !== null).length, queued: this.#queue.length };
  }

  /** Encerra os workers; o que estava em andamento ou na fila falha. */
  async close(): Promise<void> {
    this.#closed = true;
    for (const job of this.#queue.splice(0)) job.reject(new DispatchPlannerBusyError());
    await Promise.all(
      this.#slots.map(async (slot) => {
        this.#fail(slot, new DispatchPlannerBusyError());
        await slot.worker.terminate();
      }),
    );
  }

  #spawn(): Worker {
    const worker = new Worker(this.#script.url, { execArgv: this.#script.execArgv });
    // Worker ocioso não segura o processo aberto.
    worker.unref();
    worker.on('message', (message: WorkerMessage) => this.#onMessage(worker, message));
    worker.on('error', (error) => this.#onCrash(worker, error));
    worker.on('exit', (code) => this.#onCrash(worker, new Error(`Worker do otimizador saiu (código ${code})`)));
    return worker;
  }

  #run(slot: Slot, job: Job): void {
    const id = this.#nextId++;
    const timer = setTimeout(() => this.#onTimeout(slot, id), this.#options.timeoutMs);
    slot.job = { ...job, id, timer };
    slot.worker.postMessage({ id, ...job.request } satisfies WireRequest);
  }

  #onMessage(worker: Worker, response: WorkerMessage): void {
    const slot = this.#slots.find((candidate) => candidate.worker === worker);
    if (response.kind === 'ready') {
      if (slot === undefined) return;
      slot.ready = true;
      this.#bootFailures = 0;
      if (this.#slots.every((candidate) => candidate.ready)) for (const waiter of this.#readyWaiters.splice(0)) waiter.resolve();
      this.#next(slot);
      return;
    }
    const job = slot?.job;
    if (slot === undefined || job === null || job === undefined || job.id !== response.id) return;
    clearTimeout(job.timer);
    slot.job = null;
    if (response.ok) job.resolve({ plan: fromWirePlan(response.plan), executionTimeMs: response.executionTimeMs });
    else job.reject(new Error(`Falha no otimizador: ${response.error}`));
    this.#next(slot);
  }

  #onTimeout(slot: Slot, id: number): void {
    if (slot.job?.id !== id) return;
    this.#replace(slot, new DispatchPlannerTimeoutError(this.#options.timeoutMs));
  }

  #onCrash(worker: Worker, error: unknown): void {
    if (this.#closed || this.#broken !== null) return;
    const slot = this.#slots.find((candidate) => candidate.worker === worker);
    if (slot === undefined) return;
    if (!slot.ready && (this.#bootFailures += 1) >= MAX_BOOT_FAILURES) {
      this.#breakDown(error);
      return;
    }
    this.#replace(slot, error);
  }

  /** Para de recriar workers e falha tudo o que espera: o pool não tem conserto sozinho. */
  #breakDown(cause: unknown): void {
    this.#broken = new Error('O worker do otimizador não consegue iniciar', { cause });
    for (const slot of this.#slots) {
      slot.worker.removeAllListeners();
      void slot.worker.terminate();
      this.#fail(slot, this.#broken);
    }
    for (const job of this.#queue.splice(0)) job.reject(this.#broken);
    for (const waiter of this.#readyWaiters.splice(0)) waiter.reject(this.#broken);
  }

  /** Derruba o worker do slot (travado ou morto), falha o cálculo dele e põe outro no lugar. */
  #replace(slot: Slot, error: unknown): void {
    const old = slot.worker;
    old.removeAllListeners();
    void old.terminate();
    this.#fail(slot, error);
    if (this.#closed) return;
    slot.worker = this.#spawn();
    // O novo worker pega a fila quando avisar que carregou.
    slot.ready = false;
  }

  #fail(slot: Slot, error: unknown): void {
    const job = slot.job;
    if (job === null) return;
    clearTimeout(job.timer);
    slot.job = null;
    job.reject(error);
  }

  #next(slot: Slot): void {
    const job = this.#queue.shift();
    if (job !== undefined) this.#run(slot, job);
  }
}
