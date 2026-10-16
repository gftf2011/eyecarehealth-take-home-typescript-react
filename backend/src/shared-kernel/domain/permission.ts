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
] as const;

export type Permission = (typeof PERMISSIONS)[number];
