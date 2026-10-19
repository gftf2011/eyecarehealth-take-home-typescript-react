/**
 * Ações protegidas do painel, no formato `<recurso>:<ação>`. As rotas da API
 * declaram a permissão exigida; o papel do usuário decide se ele a tem.
 */
export const PERMISSIONS = [
  'products:read',
  'products:write',
  'orders:read',
  'orders:write',
  'delivery-persons:read',
  'delivery-persons:write',
  'reports:read',
  // Do próprio entregador: só as entregas e a localização dele (o caso de uso confere o dono).
  'my-deliveries:read',
  'my-deliveries:write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Permissões do entregador sobre o próprio trabalho: não fazem sentido para quem gere o painel. */
export const COURIER_PERMISSIONS: readonly Permission[] = ['my-deliveries:read', 'my-deliveries:write'];
