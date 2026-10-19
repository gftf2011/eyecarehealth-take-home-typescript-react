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
  // Do próprio entregador: só as entregas e a localização dele (a API confere o dono).
  'my-deliveries:read',
  'my-deliveries:write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Permissões do entregador sobre o próprio trabalho: não fazem sentido para quem gere o painel. */
export const COURIER_PERMISSIONS: readonly Permission[] = ['my-deliveries:read', 'my-deliveries:write'];
