import { z } from 'zod';

/** O `pagination` de toda listagem da API (paginação por cursor). */
export const paginationSchema = z.object({
  limit: z.number().int(),
  nextCursor: z.string().nullable(),
  previousCursor: z.string().nullable(),
});
