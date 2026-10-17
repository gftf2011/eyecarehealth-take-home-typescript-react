import type { Clock } from '../../shared-kernel/application';

/**
 * Relógio controlado pelo seed: cada passo do cenário posiciona o "agora"
 * antes de chamar o caso de uso, para que pedidos, transições e entregas
 * fiquem com horários realistas (os relatórios dependem deles).
 */
export class SeedClock implements Clock {
  #now: Date;

  constructor(now: Date) {
    this.#now = new Date(now.getTime());
  }

  now(): Date {
    return new Date(this.#now.getTime());
  }

  setTo(instant: Date): void {
    this.#now = new Date(instant.getTime());
  }
}

/** PRNG determinístico (mulberry32): o mesmo arquivo gera sempre o mesmo cenário. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
