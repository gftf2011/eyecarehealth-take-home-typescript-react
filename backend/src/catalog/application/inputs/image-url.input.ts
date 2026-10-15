import { ImageUrl } from '../../domain/index.js';

/**
 * Interpreta o campo `imageUrl` vindo do cliente:
 * - `undefined`: campo não enviado (em atualização, não altera).
 * - `null` ou texto em branco: produto sem imagem.
 * - texto: URL validada pelo Value Object.
 */
export function parseImageUrlInput(raw: string | null | undefined): ImageUrl | null | undefined {
  if (raw === undefined) return undefined;
  const value = raw?.trim() ?? '';
  return value === '' ? null : ImageUrl.create(value);
}
