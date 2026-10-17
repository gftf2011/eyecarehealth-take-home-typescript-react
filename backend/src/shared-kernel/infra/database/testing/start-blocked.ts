import { expect } from 'vitest';

/** Tempo para a operação concorrente chegar ao lock e ficar esperando. */
const LOCK_WAIT_MS = 300;

/**
 * Inicia `operation` e confirma que ela ficou bloqueada (ainda não terminou),
 * para testes de concorrência determinísticos: quem chama segura um lock,
 * inicia a operação concorrente, confirma que ela espera e só então confirma.
 *
 * Devolve o resultado embrulhado em um objeto: devolver a promise direto de
 * uma função async faria quem chama esperar por ela — e a operação espera
 * justamente o lock de quem chama (deadlock no teste).
 */
export async function startBlocked<T>(
  operation: () => Promise<T>,
): Promise<{ readonly outcome: Promise<PromiseSettledResult<T>> }> {
  let settled = false;
  const outcome = Promise.allSettled([operation()]).then(([result]) => {
    settled = true;
    return result as PromiseSettledResult<T>;
  });
  await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_MS));
  expect(settled).toBe(false);
  return { outcome };
}
