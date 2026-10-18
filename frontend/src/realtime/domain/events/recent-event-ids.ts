/**
 * Memória dos últimos IDs de evento recebidos. A entrega do backend é "pelo
 * menos uma vez" (outbox + relay): o mesmo evento pode chegar de novo, e o
 * painel o ignora. Limitada para não crescer sem fim numa aba aberta o dia
 * todo; os mais antigos saem primeiro.
 */
export class RecentEventIds {
  readonly #ids = new Set<string>();

  constructor(private readonly capacity = 1_000) {}

  /** `true` na primeira vez que vê o ID; `false` se é repetido. */
  remember(id: string): boolean {
    if (this.#ids.has(id)) return false;
    this.#ids.add(id);
    if (this.#ids.size > this.capacity) {
      const oldest = this.#ids.values().next().value;
      if (oldest !== undefined) this.#ids.delete(oldest);
    }
    return true;
  }
}
