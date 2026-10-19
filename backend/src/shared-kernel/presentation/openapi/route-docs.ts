import type { z } from 'zod';

/** Uma resposta documentada: o schema descreve exatamente o corpo devolvido. */
export type ResponseDoc = {
  readonly description: string;
  /** Sem schema: resposta sem corpo (ex.: `204`). */
  readonly schema?: z.ZodType;
};

/**
 * Documentação OpenAPI de uma rota, feita dos **mesmos** schemas Zod que
 * validam a requisição: a documentação não descola do código. Os erros
 * comuns (`400` de validação, `401`, `403`, `429`, `500`) entram sozinhos;
 * aqui ficam os de sucesso e os específicos da rota (ex.: `409`, `422`).
 */
export type RouteDocs = {
  readonly summary: string;
  readonly description?: string;
  /** Agrupamento no Swagger UI (o bounded context). */
  readonly tags: readonly string[];
  readonly params?: z.ZodObject;
  readonly query?: z.ZodObject;
  /** Cookies lidos pela rota (ex.: o refresh token `httpOnly`). */
  readonly cookies?: z.ZodObject;
  readonly body?: z.ZodType;
  readonly responses: Readonly<Record<number, ResponseDoc>>;
};
