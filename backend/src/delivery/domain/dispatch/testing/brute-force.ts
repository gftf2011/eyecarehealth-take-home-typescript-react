/**
 * Oráculo de força bruta para validar o algoritmo Húngaro em instâncias
 * pequenas: testa todas as atribuições injetivas linha → coluna.
 * Complexidade O(cols! / (cols − rows)!) — use só com rows ≤ 6.
 */
export function bruteForceMinCost(cost: readonly (readonly number[])[]): number {
  const cols = cost[0]?.length ?? 0;
  const usedCols = new Array<boolean>(cols).fill(false);

  const search = (row: number): number => {
    const line = cost[row];
    if (line === undefined) return 0;
    let best = Number.POSITIVE_INFINITY;
    for (let col = 0; col < cols; col++) {
      if (usedCols[col] === true) continue;
      usedCols[col] = true;
      best = Math.min(best, (line[col] ?? Number.NaN) + search(row + 1));
      usedCols[col] = false;
    }
    return best;
  };

  return search(0);
}

/** PRNG determinístico (mulberry32) para testes reprodutíveis. */
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

export function randomMatrix(rows: number, cols: number, random: () => number): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.round(random() * 10_000) / 100),
  );
}
