import type { DeliveryIssueReason, DeliveryIssueResolution, OrderStatusValue, TransitionBlocker } from '../../domain';

/** Nome de cada status na interface. */
export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatusValue, string>> = {
  pending: 'Pendente',
  preparing: 'Em preparo',
  ready: 'Pronto',
  delivering: 'Em entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

/** Texto do botão que leva o pedido para cada status. */
export const TRANSITION_ACTION_LABELS: Readonly<Record<OrderStatusValue, string>> = {
  pending: 'Voltar para pendente',
  preparing: 'Iniciar preparo',
  ready: 'Marcar como pronto',
  delivering: 'Despachar',
  delivered: 'Confirmar entrega',
  cancelled: 'Cancelar pedido',
};

export const TRANSITION_BLOCKER_MESSAGES: Readonly<Record<TransitionBlocker, string>> = {
  DELIVERY_PERSON_REQUIRED: 'Atribua um entregador na tela de atribuição para despachar.',
  DELIVERY_ISSUE_OPEN: 'O entregador relatou um problema: decida antes de concluir a entrega.',
};

export const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Mais recentes' },
  { value: 'createdAt:asc', label: 'Mais antigos' },
  { value: 'totalAmount:desc', label: 'Maior valor' },
  { value: 'totalAmount:asc', label: 'Menor valor' },
] as const;

/** Motivo que o entregador relatou. */
export const DELIVERY_ISSUE_REASON_LABELS: Readonly<Record<DeliveryIssueReason, string>> = {
  customer_absent: 'Cliente ausente',
  address_not_found: 'Endereço não encontrado',
  refused: 'Cliente recusou',
  other: 'Outro motivo',
};

/** Como o problema terminou. */
export const DELIVERY_ISSUE_RESOLUTION_LABELS: Readonly<Record<DeliveryIssueResolution, string>> = {
  retried: 'Nova tentativa',
  returned: 'Devolvido para a atribuição',
  cancelled: 'Pedido cancelado',
};
