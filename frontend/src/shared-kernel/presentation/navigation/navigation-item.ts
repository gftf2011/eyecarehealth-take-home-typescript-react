import type { Permission } from '../../domain';

/**
 * Entrada do menu do painel. Cada contexto declara as suas, com a permissão
 * exigida; o layout mostra só as que o perfil do usuário pode abrir.
 */
export type NavigationItem = {
  readonly path: string;
  readonly label: string;
  readonly permission: Permission;
};
