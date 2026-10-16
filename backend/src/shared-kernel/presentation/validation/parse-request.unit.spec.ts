import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { InputValidationError } from '../../application';
import { optionalBooleanQuery, optionalIntegerQuery, parseRequest } from './parse-request';

describe('parseRequest', () => {
  const schema = z.object({ name: z.string(), price: z.number(), tags: z.array(z.string()).optional() });

  it('devolve os dados tipados quando o formato é válido', () => {
    expect(parseRequest(schema, { name: 'Suco', price: 12.5 }, 'body')).toEqual({
      name: 'Suco',
      price: 12.5,
    });
  });

  it('agrupa os campos com formato errado, com caminho do campo e mensagem em português', () => {
    const attempt = (): unknown =>
      parseRequest(schema, { name: 10, price: '12', tags: ['ok', 1] }, 'body');

    expect(attempt).toThrow(InputValidationError);
    try {
      attempt();
    } catch (error) {
      const details = (error as InputValidationError).details;
      expect(details.map((detail) => detail['field'])).toEqual(['name', 'price', 'tags.1']);
      expect(String(details[0]?.['message'])).toMatch(/esperado|esperava/i);
    }
  });

  it('usa a origem como campo quando o problema é o objeto inteiro', () => {
    expect(() => parseRequest(schema, undefined, 'body')).toThrow(
      expect.objectContaining({ details: [expect.objectContaining({ field: 'body' })] }),
    );
  });
});

describe('helpers de query string', () => {
  const query = z.object({ page: optionalIntegerQuery, active: optionalBooleanQuery });

  it('converte números e booleanos vindos como texto', () => {
    expect(parseRequest(query, { page: '2', active: 'false' }, 'query')).toEqual({
      page: 2,
      active: false,
    });
  });

  it('mantém ausentes como undefined', () => {
    expect(parseRequest(query, {}, 'query')).toEqual({});
  });

  it.each([
    [{ page: 'dois' }, 'page'],
    [{ page: '1.5' }, 'page'],
    [{ active: 'yes' }, 'active'],
  ])('rejeita %j', (input, field) => {
    expect(() => parseRequest(query, input, 'query')).toThrow(
      expect.objectContaining({ details: [expect.objectContaining({ field })] }),
    );
  });
});
