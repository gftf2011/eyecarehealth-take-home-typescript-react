import http from 'k6/http';
import { check, fail } from 'k6';

/** Origem do painel (nginx): a carga passa pelo mesmo proxy que o navegador. */
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3200').replace(/\/$/, '');
export const API = `${BASE_URL}/api`;

/** Usuários do seed (`seed/data.json`). */
export const ADMIN = { email: 'admin@fastmeals.com', password: 'Admin@123' };
export const VIEWER = { email: 'viewer@fastmeals.com', password: 'Viewer@123' };

/**
 * Entra uma vez e devolve o access token (15 min). Os VUs reaproveitam o
 * token do `setup()`: o login usa bcrypt de propósito e tem limite de
 * tentativas, então não faz parte da carga.
 */
export function login(user) {
  const response = http.post(`${API}/auth/login`, JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /auth/login' },
  });
  if (!check(response, { 'login 200': (r) => r.status === 200 })) {
    fail(`login de ${user.email} falhou: ${response.status} ${response.body}`);
  }
  return response.json('accessToken');
}

/**
 * Requisição autenticada. `name` agrupa as métricas pela rota (sem o ID nem
 * a query), para os limites valerem por endpoint.
 */
export function request(method, path, token, { body, name, expected = [200] } = {}) {
  const response = http.request(method, `${API}${path}`, body === undefined ? null : JSON.stringify(body), {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    tags: { name: name || `${method} ${path}` },
    responseCallback: http.expectedStatuses(...expected),
  });
  check(response, { [`${name || path}: status esperado`]: (r) => expected.includes(r.status) });
  return response;
}

/** Query string a partir de um objeto, sem os valores vazios. */
export function query(params) {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

export function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

const STREETS = ['Rua das Flores', 'Av. Paulista', 'Rua Augusta', 'Av. Brasil', 'Rua da Consolação', 'Rua Oscar Freire'];
const NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João'];

/** Um pedido válido para `POST /orders`, com 1 a 3 produtos disponíveis. */
export function newOrder(productIds, sequence) {
  const count = 1 + (sequence % 3);
  const items = [];
  for (let index = 0; index < count; index += 1) {
    items.push({ productId: productIds[(sequence + index * 7) % productIds.length], quantity: 1 + (index % 2) });
  }
  return {
    customerName: `${NAMES[sequence % NAMES.length]} Carga ${sequence}`,
    customerPhone: `(11) 9${String(1000 + (sequence % 9000)).padStart(4, '0')}-${String(sequence % 10000).padStart(4, '0')}`,
    deliveryAddress: `${STREETS[sequence % STREETS.length]}, ${100 + (sequence % 900)}, São Paulo - SP`,
    latitude: -23.55 - (sequence % 100) / 1000,
    longitude: -46.63 - (sequence % 100) / 1000,
    items: dedupe(items),
  };
}

function dedupe(items) {
  const byProduct = new Map();
  for (const item of items) byProduct.set(item.productId, item);
  return [...byProduct.values()];
}

/** IDs dos produtos disponíveis (o pedido recusa indisponíveis). */
export function availableProductIds(token) {
  const response = request('GET', `/products${query({ isAvailable: true, limit: 100 })}`, token, {
    name: 'GET /products',
  });
  const ids = response.json('data.#.id');
  if (!ids || ids.length === 0) fail('nenhum produto disponível para montar pedidos');
  return ids;
}
