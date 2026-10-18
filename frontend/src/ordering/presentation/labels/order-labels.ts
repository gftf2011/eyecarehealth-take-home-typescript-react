import type { OrderStatusValue, TransitionBlocker } from '../../domain';

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
};

export const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Mais recentes' },
  { value: 'createdAt:asc', label: 'Mais antigos' },
  { value: 'totalAmount:desc', label: 'Maior valor' },
  { value: 'totalAmount:asc', label: 'Menor valor' },
] as const;
