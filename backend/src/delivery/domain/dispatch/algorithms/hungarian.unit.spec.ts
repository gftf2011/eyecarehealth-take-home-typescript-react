import { describe, expect, it } from 'vitest';

import { bruteForceMinCost, randomMatrix, seededRandom } from '../testing/brute-force';
import { solveMinCostAssignment } from './hungarian';

function totalCost(cost: readonly (readonly number[])[], assignment: readonly number[]): number {
  return assignment.reduce((sum, col, row) => sum + (cost[row]?.[col] ?? Number.NaN), 0);
}

describe('solveMinCostAssignment (Húngaro)', () => {
  it('retorna vazio para matriz vazia', () => {
    expect(solveMinCostAssignment([])).toEqual([]);
  });

  it('resolve matriz quadrada clássica', () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];

    const assignment = solveMinCostAssignment(cost);

    expect(assignment).toEqual([1, 0, 2]);
    expect(totalCost(cost, assignment)).toBe(5);
  });

  it('vence a escolha gulosa (menor aresta primeiro)', () => {
    // Guloso pega 1 (linha 0 → col 0) e é forçado a 100: total 101. Ótimo: 2 + 3 = 5.
    const cost = [
      [1, 2],
      [3, 100],
    ];

    expect(solveMinCostAssignment(cost)).toEqual([1, 0]);
  });

  it('resolve matriz retangular (mais colunas que linhas) deixando colunas livres', () => {
    const cost = [
      [9, 2, 7, 8],
      [6, 4, 3, 7],
    ];

    const assignment = solveMinCostAssignment(cost);

    expect(assignment).toEqual([1, 2]);
    expect(new Set(assignment).size).toBe(2);
  });

  it('é determinístico em empates (menor índice vence)', () => {
    const cost = [
      [1, 1, 1],
      [1, 1, 1],
    ];
    expect(solveMinCostAssignment(cost)).toEqual(solveMinCostAssignment(cost));
  });

  it.each([
    [[[1], [2]], /rows ≤ cols/],
    [[[1, 2], [3]], /retangular/],
    [[[1, Number.NaN]], /finitos/],
  ])('rejeita matriz inválida %#', (cost, message) => {
    expect(() => solveMinCostAssignment(cost)).toThrow(message);
  });

  describe('contra força bruta (instâncias aleatórias com semente fixa)', () => {
    const random = seededRandom(20250120);
    const cases = Array.from({ length: 200 }, () => {
      const rows = 1 + Math.floor(random() * 6);
      const cols = rows + Math.floor(random() * 3);
      return randomMatrix(rows, cols, random);
    });

    it('atinge sempre o custo mínimo em 200 instâncias até 6×8', () => {
      for (const cost of cases) {
        const assignment = solveMinCostAssignment(cost);
        expect(new Set(assignment).size).toBe(cost.length);
        expect(totalCost(cost, assignment)).toBeCloseTo(bruteForceMinCost(cost), 9);
      }
    });
  });
});
