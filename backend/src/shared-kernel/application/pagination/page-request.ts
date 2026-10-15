import { validateInput } from '../validation/validate-input.js';
import { InvalidPaginationError } from './invalid-pagination.error.js';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Página solicitada (1-based) e tamanho da página. */
export class PageRequest {
  readonly page: number;
  readonly limit: number;

  private constructor(page: number, limit: number) {
    this.page = page;
    this.limit = limit;
  }

  /** Padrão: página 1 com 20 itens; limite máximo de 100. */
  static create(page?: number, limit?: number): PageRequest {
    const validated = validateInput({
      page: () => validatePage(page ?? 1),
      limit: () => validateLimit(limit ?? DEFAULT_PAGE_LIMIT),
    });
    return new PageRequest(validated.page, validated.limit);
  }

  /** Quantos registros pular (para OFFSET). */
  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}

function validatePage(page: number): number {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new InvalidPaginationError('page', 'A página deve ser um inteiro maior ou igual a 1');
  }
  return page;
}

function validateLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new InvalidPaginationError(
      'limit',
      `O limite deve ser um inteiro entre 1 e ${MAX_PAGE_LIMIT}`,
    );
  }
  return limit;
}
