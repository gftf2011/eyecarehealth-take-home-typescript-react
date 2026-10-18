/**
 * Ações protegidas do painel, no formato `<recurso>:<ação>` — as mesmas da
 * API. Telas e botões declaram a permissão exigida só para guiar a interface:
 * quem autoriza de fato continua sendo a API.
 */
export const PERMISSIONS = [
  'products:read',
  'products:write',
  'orders:read',
  'orders:write',
  'delivery-persons:read',
  'delivery-persons:write',
  'reports:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
