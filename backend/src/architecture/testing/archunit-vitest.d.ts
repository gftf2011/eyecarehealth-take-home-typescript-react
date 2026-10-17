import type { CheckOptions } from 'archunit';

/**
 * Tipagem do matcher do ArchUnitTS para o Vitest 5. A declaração que vem no
 * pacote estende uma interface global que o Vitest 5 não usa mais; aqui ela é
 * ligada ao ponto de extensão oficial (`Matchers`), com a mesma assinatura de
 * parâmetros de tipo que o Vitest declara.
 */
declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toPassAsync(options?: CheckOptions): Promise<void>;
  }
}
