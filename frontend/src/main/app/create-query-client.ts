import { QueryClient } from '@tanstack/react-query';

import { UnavailableError } from '../../shared-kernel/domain';

const MAX_RETRIES = 2;

/**
 * Cache das consultas à API. Só falhas transitórias (rede, 5xx) são
 * repetidas: um 401/403/404/422 não muda tentando de novo.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failures, error) => error instanceof UnavailableError && failures < MAX_RETRIES,
      },
      mutations: { retry: false },
    },
  });
}
