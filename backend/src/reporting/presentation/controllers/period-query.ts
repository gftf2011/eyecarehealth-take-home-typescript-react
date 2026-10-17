import { z } from 'zod';

/** `startDate`/`endDate` da query string; o formato `YYYY-MM-DD` é validado no caso de uso. */
export const periodQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
