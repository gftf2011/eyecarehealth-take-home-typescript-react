import type { RawData } from 'ws';

/**
 * Texto de uma mensagem do `ws`. O tipo cobre Buffer, ArrayBuffer e lista de
 * Buffers (mensagem fragmentada); `toString()` direto juntaria os fragmentos
 * de uma lista com vírgulas.
 */
export function rawDataToText(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}
