import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../errors/input-validation.error';
import { toPage } from './page';
import { PageRequest } from './page-request';

describe('PageRequest', () => {
  it('usa página 1 e limite 20 por padrão', () => {
    const request = PageRequest.create();
    expect([request.page, request.limit, request.offset]).toEqual([1, 20, 0]);
  });

  it('calcula o offset', () => {
    expect(PageRequest.create(3, 20).offset).toBe(40);
  });

  it('reporta page e limit inválidos juntos', () => {
    expect(() => PageRequest.create(0, 101)).toThrow(InputValidationError);
    expect(() => PageRequest.create(0, 101)).toThrow(
      expect.objectContaining({
        details: [
          { field: 'page', message: 'A página deve ser um inteiro maior ou igual a 1' },
          { field: 'limit', message: 'O limite deve ser um inteiro entre 1 e 100' },
        ],
      }),
    );
  });

  it.each([
    [1.5, 20],
    [1, 0],
    [1, 2.5],
  ])('rejeita page=%d limit=%d', (page, limit) => {
    expect(() => PageRequest.create(page, limit)).toThrow(InputValidationError);
  });
});

describe('toPage', () => {
  it.each([
    [47, 20, 3],
    [40, 20, 2],
    [0, 20, 0],
    [1, 100, 1],
  ])('total %d com limite %d → %d páginas', (total, limit, totalPages) => {
    const page = toPage({ items: [], total }, PageRequest.create(1, limit));
    expect(page.pagination).toEqual({ page: 1, limit, total, totalPages });
  });

  it('rejeita resultado inconsistente do adapter', () => {
    expect(() => toPage({ items: [1, 2, 3], total: 3 }, PageRequest.create(1, 2))).toThrow(
      RangeError,
    );
    expect(() => toPage({ items: [], total: -1 }, PageRequest.create())).toThrow(RangeError);
  });
});
