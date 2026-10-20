import exec from 'k6/execution';

import { ADMIN, availableProductIds, login, newOrder, request } from './lib/api.js';

/**
 * Prepara o volume: cria `ORDERS` pedidos (padrão 25.000) pela própria API,
 * como o painel criaria, e espalha os status. Já é carga de escrita: cada
 * pedido passa pelo caso de uso, pelo outbox e pelo SNS/SQS até o tempo real.
 *
 *   k6 run -e ORDERS=25000 backend/load-tests/seed-orders.js (com BASE_URL de uma stack de pé)
 */
const ORDERS = Number(__ENV.ORDERS || 25000);

export const options = {
  scenarios: {
    seed: { executor: 'shared-iterations', vus: Number(__ENV.VUS || 20), iterations: ORDERS, maxDuration: '15m' },
  },
  thresholds: {
    // Falhando (token vencido, API fora), para logo: não adianta seguir só com erros.
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '10s' }],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const token = login(ADMIN);
  return { token, productIds: availableProductIds(token) };
}

/** Distribuição de status: 40% pendentes, 20% em preparo, 20% prontos, 20% cancelados. */
const PATH_BY_SLOT = [
  [], [], [], [],
  ['preparing'], ['preparing'],
  ['preparing', 'ready'], ['preparing', 'ready'],
  ['cancelled'], ['preparing', 'cancelled'],
];

export default function seed({ token, productIds }) {
  const sequence = exec.scenario.iterationInTest;
  const created = request('POST', '/orders', token, {
    body: newOrder(productIds, sequence),
    name: 'POST /orders',
    expected: [201],
  });
  if (created.status !== 201) return;
  const id = created.json('id');
  for (const status of PATH_BY_SLOT[sequence % PATH_BY_SLOT.length]) {
    request('PATCH', `/orders/${id}/status`, token, { body: { status }, name: 'PATCH /orders/:id/status' });
  }
}
