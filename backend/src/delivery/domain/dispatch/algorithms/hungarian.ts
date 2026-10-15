/**
 * Algoritmo Húngaro (Kuhn–Munkres) com potenciais, para o problema de
 * atribuição de custo mínimo em uma matriz retangular `rows × cols`, com
 * `rows ≤ cols`. Cada linha recebe exatamente uma coluna distinta, minimizando
 * a soma dos custos.
 *
 * Complexidade: O(rows² · cols) em tempo e O(cols) de memória extra. Para 30
 * entregadores × 50 pedidos são ~45 mil passos — microssegundos.
 *
 * Funcionamento: mantém potenciais `u` (linhas) e `v` (colunas) tais que
 * `cost[i][j] − u[i] − v[j] ≥ 0`. Cada linha nova é inserida por um caminho
 * aumentante de custo reduzido mínimo (uma variação de Dijkstra), ajustando
 * os potenciais em `delta` a cada passo. Ao fim, as arestas de custo reduzido
 * zero formam um emparelhamento ótimo.
 *
 * O desempate é determinístico: entre colunas de mesmo custo reduzido, vence
 * a de menor índice. Logo, a mesma matriz gera sempre a mesma atribuição.
 *
 * @returns `assignment[row] = col` atribuída àquela linha.
 */
export function solveMinCostAssignment(cost: readonly (readonly number[])[]): number[] {
  const rows = cost.length;
  if (rows === 0) return [];
  const cols = at(cost, 0).length;
  assertValidMatrix(cost, rows, cols);

  // Índices 1-based; a coluna 0 é uma sentinela usada para iniciar cada caminho.
  const u = new Float64Array(rows + 1);
  const v = new Float64Array(cols + 1);
  const matchedRowOfCol = new Int32Array(cols + 1);
  const previousColOnPath = new Int32Array(cols + 1);

  for (let row = 1; row <= rows; row++) {
    matchedRowOfCol[0] = row;
    let currentCol = 0;
    const minReducedCost = new Float64Array(cols + 1).fill(Number.POSITIVE_INFINITY);
    const visited = new Uint8Array(cols + 1);

    // Expande o caminho até encontrar uma coluna livre.
    do {
      visited[currentCol] = 1;
      const pathRow = at(matchedRowOfCol, currentCol);
      let delta = Number.POSITIVE_INFINITY;
      let nextCol = 0;

      for (let col = 1; col <= cols; col++) {
        if (visited[col] === 1) continue;
        const reduced = at(at(cost, pathRow - 1), col - 1) - at(u, pathRow) - at(v, col);
        if (reduced < at(minReducedCost, col)) {
          minReducedCost[col] = reduced;
          previousColOnPath[col] = currentCol;
        }
        if (at(minReducedCost, col) < delta) {
          delta = at(minReducedCost, col);
          nextCol = col;
        }
      }

      for (let col = 0; col <= cols; col++) {
        if (visited[col] === 1) {
          const matchedRow = at(matchedRowOfCol, col);
          u[matchedRow] = at(u, matchedRow) + delta;
          v[col] = at(v, col) - delta;
        } else {
          minReducedCost[col] = at(minReducedCost, col) - delta;
        }
      }

      currentCol = nextCol;
    } while (at(matchedRowOfCol, currentCol) !== 0);

    // Inverte o caminho aumentante, liberando a sentinela.
    do {
      const previousCol = at(previousColOnPath, currentCol);
      matchedRowOfCol[currentCol] = at(matchedRowOfCol, previousCol);
      currentCol = previousCol;
    } while (currentCol !== 0);
  }

  const assignment = new Array<number>(rows).fill(-1);
  for (let col = 1; col <= cols; col++) {
    const row = at(matchedRowOfCol, col);
    if (row !== 0) assignment[row - 1] = col - 1;
  }
  return assignment;
}

function assertValidMatrix(cost: readonly (readonly number[])[], rows: number, cols: number): void {
  if (rows > cols) {
    throw new RangeError(`A matriz deve ter rows ≤ cols (recebido ${rows}×${cols}); transponha antes.`);
  }
  for (const line of cost) {
    if (line.length !== cols) throw new RangeError('A matriz de custos deve ser retangular.');
    if (!line.every(Number.isFinite)) throw new RangeError('Os custos devem ser números finitos.');
  }
}

/** Leitura indexada com verificação de limites (exigida por noUncheckedIndexedAccess). */
function at<T>(values: ArrayLike<T>, index: number): T {
  const value = values[index];
  if (value === undefined) throw new RangeError(`Índice fora dos limites: ${index}`);
  return value;
}
