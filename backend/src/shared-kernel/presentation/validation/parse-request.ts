import { z } from 'zod';

import { InputValidationError } from '../../application';

// Mensagens de formato (tipo errado, campo ausente) em português.
z.config(z.locales.pt());

/**
 * Valida o **formato** da requisição (tipos, campos presentes, conversão de
 * query string). As regras de negócio dos valores ficam nos Value Objects.
 * Falhas viram `InputValidationError` com um detalhe por campo.
 */
export function parseRequest<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
  source: 'body' | 'query' | 'params',
): z.output<TSchema> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  throw new InputValidationError(
    result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.map(String).join('.') : source,
      message: issue.message,
    })),
  );
}

/** Inteiro opcional vindo da query string (`?page=2`). */
export const optionalIntegerQuery = z.coerce.number().int().optional();

/** Booleano vindo da query string: só `true` ou `false`. */
export const optionalBooleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

/** Parâmetro de rota `:id`; o formato UUID é validado pelo Value Object do domínio. */
export const idParams = z.object({ id: z.string() });
