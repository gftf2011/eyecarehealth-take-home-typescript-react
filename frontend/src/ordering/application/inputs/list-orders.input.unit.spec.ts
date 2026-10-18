import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../shared-kernel/application';
import { listOrdersInputErrors, parseListOrdersInput } from './list-orders.input';

describe('parseListOrdersInput', () => {
  it('sem filtros: página 1, 20 por página, mais recentes primeiro', () => {
    const criteria = parseListOrdersInput({});

    expect(criteria).toMatchObject({ page: 1, limit: 20, status: null, sort: { field: 'createdAt', direction: 'desc' } });
    expect(criteria.createdOn.start).toBeNull();
    expect(criteria.createdOn.end).toBeNull();
  });

  it('campos vazios (vindos da URL ou do formulário) contam como ausentes', () => {
    expect(parseListOrdersInput({ status: '', startDate: ' ', sortBy: '', sortOrder: '' })).toMatchObject({
      status: null,
      sort: { field: 'createdAt', direction: 'desc' },
    });
  });

  it('aceita status, período e ordenação válidos', () => {
    const criteria = parseListOrdersInput({
      page: 2,
      status: 'ready',
      startDate: '2026-10-01',
      endDate: '2026-10-17',
      sortBy: 'totalAmount',
      sortOrder: 'asc',
    });

    expect(criteria).toMatchObject({ page: 2, status: 'ready', sort: { field: 'totalAmount', direction: 'asc' } });
    expect(criteria.createdOn.start?.toString()).toBe('2026-10-01');
    expect(criteria.createdOn.end?.toString()).toBe('2026-10-17');
  });

  it.each([
    [{ status: 'shipped' }, 'status'],
    [{ startDate: '2026-02-30' }, 'startDate'],
    [{ endDate: '17/10/2026' }, 'endDate'],
    [{ startDate: '2026-10-17', endDate: '2026-10-01' }, 'endDate'],
    [{ sortBy: 'customerName' }, 'sortBy'],
    [{ sortOrder: 'up' }, 'sortOrder'],
    [{ page: 0 }, 'page'],
    [{ page: Number.NaN }, 'page'],
    [{ limit: 101 }, 'limit'],
  ])('recusa %j apontando o campo %s', (input, field) => {
    expect(() => parseListOrdersInput(input)).toThrow(InputValidationError);
    expect(listOrdersInputErrors(input)).toHaveProperty(field);
  });

  it('mostra todos os campos inválidos de uma vez', () => {
    expect(Object.keys(listOrdersInputErrors({ status: 'x', startDate: 'y', sortBy: 'z' }))).toEqual([
      'status',
      'startDate',
      'sortBy',
    ]);
  });
});
