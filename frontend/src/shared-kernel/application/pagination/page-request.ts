import { InvalidPaginationError } from './invalid-pagination.error';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
/** Os cursores da API têm algumas dezenas de caracteres; muito mais que isso não veio dela. */
const MAX_CURSOR_LENGTH = 512;
const CURSOR_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Tamanho da página: padrão 20, máximo 100 (as mesmas regras da API). */
export function parsePageLimit(limit: number | undefined): number {
  const value = limit ?? DEFAULT_PAGE_LIMIT;
  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE_LIMIT) {
    throw new InvalidPaginationError('limit', `O limite deve ser um inteiro entre 1 e ${MAX_PAGE_LIMIT}`);
  }
  return value;
}

/**
 * Cursor opaco da API (`nextCursor`/`previousCursor`); vazio = primeira
 * página. O painel não interpreta o conteúdo: só recusa o que claramente não
 * é um cursor (ex.: um link editado à mão), e a API valida o resto.
 */
export function parseCursor(cursor: string | undefined): string | null {
  const value = cursor?.trim() ?? '';
  if (value === '') return null;
  if (value.length > MAX_CURSOR_LENGTH || !CURSOR_PATTERN.test(value)) {
    throw new InvalidPaginationError('cursor', 'Link de página inválido: volte para a primeira página');
  }
  return value;
}
