import type {
  DeliveryIssue,
  DeliveryIssueDecision,
  Order,
  OrderStatusValue,
  StatusChange,
  StatusTransition,
} from '../../domain';

export type OrderItemDto = {
  readonly id: string;
  readonly productName: string;
  readonly quantity: number;
  /** Em centavos, para a interface formatar sem erro de arredondamento. */
  readonly unitPriceCents: number;
  readonly subtotalCents: number;
};

/** O que a interface mostra de um pedido, já com as ações possíveis. */
export type OrderDto = {
  readonly id: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly deliveryAddress: string;
  readonly status: OrderStatusValue;
  readonly items: readonly OrderItemDto[];
  readonly itemCount: number;
  readonly totalCents: number;
  readonly deliveryPerson: { readonly id: string; readonly name: string } | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Transições oferecidas a partir do status atual (botões contextuais). */
  readonly transitions: readonly StatusTransition[];
  /** Em entrega: o gestor pode devolvê-la para a atribuição, com motivo. */
  readonly canReturnToAssignment: boolean;
  /** Da criação até o status atual. */
  readonly statusHistory: readonly StatusChange[];
  /** Tentativas de entrega que falharam, na ordem. */
  readonly deliveryIssues: readonly DeliveryIssue[];
  /** O problema que espera o gestor decidir (tentar de novo, devolver, cancelar). */
  readonly openDeliveryIssue: DeliveryIssue | null;
  /** O que o gestor pode decidir agora sobre o problema aberto. */
  readonly deliveryIssueDecisions: readonly DeliveryIssueDecision[];
};

export function toOrderDto(order: Order): OrderDto {
  return {
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    status: order.status.value,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPrice.cents,
      subtotalCents: item.unitPrice.multiply(item.quantity).cents,
    })),
    itemCount: order.itemCount,
    totalCents: order.totalAmount.cents,
    deliveryPerson: order.deliveryPerson,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    transitions: order.transitions(),
    canReturnToAssignment: order.canReturnToAssignment,
    statusHistory: order.statusHistory,
    deliveryIssues: order.deliveryIssues,
    openDeliveryIssue: order.openDeliveryIssue,
    deliveryIssueDecisions: order.deliveryIssueDecisions,
  };
}
