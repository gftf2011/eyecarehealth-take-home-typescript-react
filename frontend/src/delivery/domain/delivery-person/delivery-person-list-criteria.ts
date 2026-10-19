/** Filtros da listagem de entregadores, já validados (`null` = todos). */
export type DeliveryPersonListCriteria = {
  readonly isActive: boolean | null;
  /** `true`: sem pedido em `delivering`; `false`: em entrega. */
  readonly available: boolean | null;
};
