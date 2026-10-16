/** Filtros da listagem de entregadores. Removidos (soft delete) nunca aparecem. */
export type DeliveryPersonListCriteria = {
  /** `null` = ativos e inativos. */
  readonly isActive: boolean | null;
};
