export const VEHICLE_TYPES = ['bicycle', 'motorcycle', 'car'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** Pedido `ready` aguardando entregador, como o Delivery precisa enxergá-lo. */
export type ReadyOrder = {
  readonly id: string;
  readonly customerName: string;
  readonly deliveryAddress: string;
  readonly totalCents: number;
  readonly itemCount: number;
  /** Entregador já atribuído (o otimizador pode redistribuir). */
  readonly assignedDeliveryPersonName: string | null;
  readonly createdAt: Date;
};

/** Entregador ativo e sem entrega em andamento. */
export type AvailableCourier = {
  readonly id: string;
  readonly name: string;
  readonly vehicleType: VehicleType;
  /** Sem localização, ele não entra no cálculo de distâncias. */
  readonly hasLocation: boolean;
};

/** O que a tela de atribuição mostra antes da sugestão. */
export type DispatchBoard = {
  readonly readyOrders: readonly ReadyOrder[];
  /** Total de pedidos prontos (a lista pode vir limitada a uma página). */
  readonly readyOrdersTotal: number;
  readonly availableCouriers: readonly AvailableCourier[];
};
