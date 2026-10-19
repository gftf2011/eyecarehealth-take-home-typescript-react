/**
 * Worker do otimizador de atribuição: roda o Húngaro fora da thread da API,
 * para um cálculo grande (1000 × 1000 leva ~2 s) não travar as outras
 * requisições. Recebe um `WireRequest` por vez e responde um `WireResponse`.
 */
import { parentPort } from 'node:worker_threads';

import { DispatchOptimizer } from '../../domain';
import {
  fromWireCandidates,
  fromWireOrders,
  toWirePlan,
  type WireReady,
  type WireRequest,
  type WireResponse,
} from './dispatch-wire';

if (parentPort === null) throw new Error('dispatch-planner.worker deve rodar como worker_thread');
const port = parentPort;
const optimizer = new DispatchOptimizer();

port.on('message', (request: WireRequest) => {
  let response: WireResponse;
  try {
    const startedAt = performance.now();
    const plan = optimizer.plan(fromWireOrders(request.orders), fromWireCandidates(request.candidates));
    response = { kind: 'result', id: request.id, ok: true, plan: toWirePlan(plan), executionTimeMs: performance.now() - startedAt };
  } catch (error) {
    response = { kind: 'result', id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  port.postMessage(response);
});

// Só depois de carregar tudo: o timeout de um cálculo não conta o boot do worker.
port.postMessage({ kind: 'ready' } satisfies WireReady);
