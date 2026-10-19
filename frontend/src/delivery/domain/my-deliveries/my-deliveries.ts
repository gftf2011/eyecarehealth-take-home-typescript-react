/** Status em que um pedido aparece para o entregador (os que ainda não terminaram). */
export const COURIER_DELIVERY_STATUSES = ['pending', 'preparing', 'ready', 'delivering'] as const;

export type CourierDeliveryStatus = (typeof COURIER_DELIVERY_STATUSES)[number];

/** Um pedido do entregador logado, com o que ele precisa para entregar. */
export type CourierDelivery = {
  readonly orderId: string;
  readonly status: CourierDeliveryStatus;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly deliveryAddress: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly items: readonly { readonly productName: string; readonly quantity: number }[];
  readonly totalCents: number;
  readonly createdAt: Date;
};

/** A tela do entregador: quem ele é, a entrega em andamento e as próximas. */
export type MyDeliveries = {
  readonly courier: { readonly id: string; readonly name: string };
  readonly inProgress: CourierDelivery | null;
  readonly upcoming: readonly CourierDelivery[];
};
