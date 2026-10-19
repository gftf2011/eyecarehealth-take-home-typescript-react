import { describe, expect, it } from 'vitest';

import { listProductsInputErrors, parseListProductsInput } from './list-products.input';

describe('parseListProductsInput', () => {
  it('padrões: primeira página, todos os produtos, mais recentes primeiro', () => {
    expect(parseListProductsInput({})).toEqual({
      cursor: null,
      limit: 20,
      search: null,
      category: null,
      isAvailable: null,
      sort: { field: 'createdAt', direction: 'desc' },
    });
  });

  it('busca com espaços nas pontas é aparada; vazia é ignorada', () => {
    expect(parseListProductsInput({ search: '  burger ' }).search).toBe('burger');
    expect(parseListProductsInput({ search: '   ' }).search).toBeNull();
  });

  it.each([
    ['true', true],
    ['false', false],
    ['', null],
  ])('disponibilidade %j → %s', (raw, expected) => {
    expect(parseListProductsInput({ isAvailable: raw }).isAvailable).toBe(expected);
  });

  it.each([
    [{ search: 'x'.repeat(121) }, 'search'],
    [{ category: 'pizza' }, 'category'],
    [{ isAvailable: 'sim' }, 'isAvailable'],
    [{ sortBy: 'category' }, 'sortBy'],
    [{ limit: 0 }, 'limit'],
    [{ cursor: 'cursor/editado' }, 'cursor'],
  ])('recusa %j no campo %s', (input, field) => {
    expect(listProductsInputErrors(input)).toHaveProperty(field);
  });
});
