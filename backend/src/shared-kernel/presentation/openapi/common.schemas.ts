import { z } from 'zod';

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../application';

/** Data e hora em ISO 8601 (UTC), como os `Date` saem no JSON. */
export const isoDateTime = z.iso.datetime().meta({ examples: ['2026-10-17T15:30:00.000Z'] });

export const uuid = z.uuid().meta({ examples: ['3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b'] });

/** Formato padrão de erro da API (todas as respostas 4xx e 5xx). */
export const errorResponseSchema = z
  .strictObject({
    error: z.strictObject({
      code: z.string().meta({ description: 'Código estável, para o cliente decidir o que fazer', examples: ['VALIDATION_ERROR'] }),
      message: z.string().meta({ description: 'Mensagem legível, em português' }),
      details: z
        .array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])))
        .optional()
        .meta({ description: 'Detalhes por campo (ex.: `{ field, message }` na validação)' }),
    }),
  });

const paginationSchema = z.strictObject({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

/** Página `{ data, pagination }` de qualquer listagem. */
export function pageOf<T extends z.ZodType>(item: T) {
  return z.strictObject({ data: z.array(item), pagination: paginationSchema });
}

/** Query de paginação documentada (a validação fica no `PageRequest`). */
export const PAGE_DOC = `Página a partir de 1; \`limit\` de 1 a ${MAX_PAGE_LIMIT} (padrão ${DEFAULT_PAGE_LIMIT}).`;
