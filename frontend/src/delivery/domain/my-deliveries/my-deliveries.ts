/** Status em que um pedido aparece para o entregador (os que ainda não terminaram). */
export const COURIER_DELIVERY_STATUSES = ['pending', 'preparing', 'ready', 'delivering'] as const;

export type CourierDeliveryStatus = (typeof COURIER_DELIVERY_STATUSES)[number];

/** Por que o entregador não conseguiu entregar (mesmos valores da API). */
export const COURIER_ISSUE_REASONS = ['customer_absent', 'address_not_found', 'refused', 'other'] as const;

export type CourierIssueReason = (typeof COURIER_ISSUE_REASONS)[number];

/** O problema que ele relatou e que espera a decisão do gestor. */
export type OpenCourierIssue = {
  readonly reason: CourierIssueReason;
  readonly note: string | null;
  readonly reportedAt: Date;
};

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
  /** Problema relatado por ele e ainda sem decisão do gestor. */
  readonly openIssue: OpenCourierIssue | null;
  readonly createdAt: Date;
};

/** A tela do entregador: quem ele é, a entrega em andamento e as próximas. */
export type MyDeliveries = {
  readonly courier: { readonly id: string; readonly name: string };
  readonly inProgress: CourierDelivery | null;
  readonly upcoming: readonly CourierDelivery[];
};
