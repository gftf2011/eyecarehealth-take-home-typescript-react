import { ADMIN, availableProductIds, login, newOrder, pick, query, request, VIEWER } from './lib/api.js';

/**
 * Carga mista nos principais endpoints, com taxa fixa de chegada (o que um
 * painel em uso real gera), sobre o volume criado por `seed-orders.js`.
 *
 *   k6 run -e DURATION=2m -e RATE=1 backend/load-tests/endpoints.js (com BASE_URL de uma stack de pé)
 *
 * `RATE` multiplica todas as taxas (2 = o dobro de requisições por segundo).
 * Os limites seguem o enunciado: listagens em menos de 200 ms (p95) e a
 * otimização em menos de 2 s.
 */
const DURATION = __ENV.DURATION || '1m';
const RATE = Number(__ENV.RATE || 1);

function scenario(exec, perSecond, maxVUs = 50) {
  return {
    executor: 'constant-arrival-rate',
    exec,
    rate: Math.max(1, Math.round(perSecond * RATE)),
    timeUnit: '1s',
    duration: DURATION,
    preAllocatedVUs: Math.ceil(maxVUs / 2),
    maxVUs,
  };
}

export const options = {
  scenarios: {
    orders_list: scenario('ordersList', 30),
    order_details: scenario('orderDetails', 20),
    products_list: scenario('productsList', 15),
    reports: scenario('reports', 5),
    delivery_persons: scenario('deliveryPersons', 5),
    place_order: scenario('placeOrder', 5),
    optimize_assignment: scenario('optimizeAssignment', 1, 10),
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{name:GET /orders}': ['p(95)<200'],
    'http_req_duration{name:GET /orders (próximas páginas)}': ['p(95)<200'],
    'http_req_duration{name:GET /orders/:id}': ['p(95)<200'],
    'http_req_duration{name:GET /products}': ['p(95)<200'],
    'http_req_duration{name:GET /delivery-persons}': ['p(95)<200'],
    'http_req_duration{name:GET /reports/*}': ['p(95)<500'],
    'http_req_duration{name:POST /orders}': ['p(95)<300'],
    'http_req_duration{name:PATCH /orders/:id/status}': ['p(95)<300'],
    'http_req_duration{name:POST /orders/optimize-assignment}': ['p(95)<2000'],
    // Fila de chegada: se a API não dá conta da taxa, o k6 descarta iterações.
    dropped_iterations: ['count<10'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const STATUSES = ['', 'pending', 'preparing', 'ready', 'cancelled', 'delivered'];
const SORTS = [
  { sortBy: 'createdAt', sortOrder: 'desc' },
  { sortBy: 'createdAt', sortOrder: 'asc' },
  { sortBy: 'totalAmount', sortOrder: 'desc' },
];
const SEARCHES = ['', '', 'burger', 'suco', 'pizza', 'a'];
const CATEGORIES = ['', '', 'meal', 'drink', 'dessert', 'side'];

/** Dia local de São Paulo (UTC−3), `YYYY-MM-DD`. */
function localDay(offsetDays = 0) {
  return new Date(Date.now() - 3 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function setup() {
  const admin = login(ADMIN);
  const viewer = login(VIEWER);
  const page = request('GET', `/orders${query({ limit: 100 })}`, admin, { name: 'GET /orders' });
  const orderIds = page.json('data.#.id');
  if (!orderIds || orderIds.length === 0) throw new Error('sem pedidos: rode antes o seed-orders.js');
  return { admin, viewer, orderIds, productIds: availableProductIds(admin) };
}

/** O painel de pedidos: filtro e ordenação ao acaso, e às vezes as páginas seguintes. */
export function ordersList({ viewer }) {
  const filters = {
    status: pick(STATUSES),
    ...pick(SORTS),
    ...(Math.random() < 0.3 ? { startDate: localDay(-1), endDate: localDay() } : {}),
  };
  let response = request('GET', `/orders${query(filters)}`, viewer, { name: 'GET /orders' });
  const depth = Math.floor(Math.random() * 4);
  for (let page = 0; page < depth; page += 1) {
    const cursor = response.json('pagination.nextCursor');
    if (!cursor) return;
    response = request('GET', `/orders${query({ ...filters, cursor })}`, viewer, {
      name: 'GET /orders (próximas páginas)',
    });
  }
}

export function orderDetails({ viewer, orderIds }) {
  request('GET', `/orders/${pick(orderIds)}`, viewer, { name: 'GET /orders/:id' });
}

export function productsList({ viewer }) {
  const filters = {
    search: pick(SEARCHES),
    category: pick(CATEGORIES),
    sortBy: pick(['createdAt', 'name', 'price']),
    sortOrder: pick(['asc', 'desc']),
  };
  request('GET', `/products${query(filters)}`, viewer, { name: 'GET /products' });
}

export function reports({ viewer }) {
  const period = { startDate: localDay(-30), endDate: localDay() };
  const path = pick([
    `/reports/revenue${query(period)}`,
    `/reports/orders-by-status${query(period)}`,
    `/reports/top-products${query(period)}`,
    `/reports/average-delivery-time${query(period)}`,
  ]);
  request('GET', path, viewer, { name: 'GET /reports/*' });
}

export function deliveryPersons({ admin }) {
  request('GET', `/delivery-persons${query({ isActive: pick(['', 'true']) })}`, admin, {
    name: 'GET /delivery-persons',
  });
}

/** O gestor cria o pedido e o manda para a cozinha. */
export function placeOrder({ admin, productIds }) {
  const created = request('POST', '/orders', admin, {
    body: newOrder(productIds, Math.floor(Math.random() * 1_000_000)),
    name: 'POST /orders',
    expected: [201],
  });
  if (created.status !== 201) return;
  request('PATCH', `/orders/${created.json('id')}/status`, admin, {
    body: { status: 'preparing' },
    name: 'PATCH /orders/:id/status',
  });
}

/** A sugestão de atribuição sobre todos os pedidos prontos (milhares, depois do seed). */
export function optimizeAssignment({ admin }) {
  request('POST', '/orders/optimize-assignment', admin, { name: 'POST /orders/optimize-assignment' });
}
