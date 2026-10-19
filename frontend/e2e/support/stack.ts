import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Stack já de pé, informada por fora (ex.: um ambiente de staging local). */
const EXTERNAL_BASE_URL = process.env['E2E_BASE_URL'];

/** Portas da stack de testes: diferentes das de desenvolvimento, para as duas conviverem. */
const PORTS = {
  FRONTEND_PORT: '3100',
  API_PORT: '3101',
  REALTIME_PORT: '3102',
  POSTGRES_PORT: '55432',
  REDIS_PORT: '56379',
  FLOCI_PORT: '45666',
} as const;

export const E2E_BASE_URL = EXTERNAL_BASE_URL ?? `http://localhost:${PORTS.FRONTEND_PORT}`;
export const MANAGES_STACK = EXTERNAL_BASE_URL === undefined;

const PROJECT = 'fastmeals-e2e';
const COMPOSE_FILE = fileURLToPath(new URL('../../../docker-compose.yml', import.meta.url));

/** `docker compose` do projeto de testes, com as portas e o rate limit dele. */
export function compose(...args: string[]): void {
  execFileSync('docker', ['compose', '-f', COMPOSE_FILE, '-p', PROJECT, ...args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...PORTS,
      // Todos os testes saem do mesmo IP: o limite de 100/min da API derrubaria a suíte.
      RATE_LIMIT_MAX: '100000',
      // A stack de testes não sobe o otel-lgtm: sem destino, os processos nem tentam exportar.
      OTEL_SDK_DISABLED: 'true',
    },
  });
}
