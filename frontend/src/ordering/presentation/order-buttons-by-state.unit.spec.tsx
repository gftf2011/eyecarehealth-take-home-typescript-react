import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Permission } from '../../shared-kernel/domain';
import { toOrderDto } from '../application';
import type { DeliveryIssue, DeliveryIssueDecision, OrderStatusValue } from '../domain';
import { buildOrder } from '../domain/order/testing/order.fixture';
import { DeliveryIssuePanel } from './components/delivery-issue-panel/delivery-issue-panel';
import { OrderActions } from './components/order-actions/order-actions';
import { renderWithOrdering } from './testing/render-with-ordering';

const COURIER = { id: 'c-1', name: 'Carlos Santos' };

function issue(reason: DeliveryIssue['reason'], resolution: DeliveryIssue['resolution'] = null): DeliveryIssue {
  return {
    id: `issue-${reason}-${resolution ?? 'open'}`,
    reason,
    note: null,
    reportedAt: new Date('2026-10-17T16:00:00Z'),
    resolvedAt: resolution === null ? null : new Date('2026-10-17T16:05:00Z'),
    resolution,
  };
}

type Scenario = {
  readonly status: OrderStatusValue;
  readonly courier?: boolean;
  readonly issues?: readonly DeliveryIssue[];
  /** O que a API devolve em `deliveryIssueDecisions` nesse estado. */
  readonly decisions?: readonly DeliveryIssueDecision[];
};

/** Os mesmos estados da matriz da API (`order-state-matrix.e2e.spec.ts`). */
const STATES: Readonly<Record<string, Scenario>> = {
  pending: { status: 'pending' },
  preparing: { status: 'preparing' },
  ready: { status: 'ready' },
  'ready com entregador': { status: 'ready', courier: true },
  delivering: { status: 'delivering', courier: true },
  'problema: cliente ausente': {
    status: 'delivering',
    courier: true,
    issues: [issue('customer_absent')],
    decisions: ['retry', 'return', 'cancel'],
  },
  'problema: cliente recusou': { status: 'delivering', courier: true, issues: [issue('refused')], decisions: ['cancel'] },
  'problema depois de 2 novas tentativas': {
    status: 'delivering',
    courier: true,
    issues: [issue('customer_absent', 'retried'), issue('address_not_found', 'retried'), issue('customer_absent')],
    decisions: ['return', 'cancel'],
  },
  delivered: { status: 'delivered', courier: true },
  cancelled: { status: 'cancelled' },
};

/**
 * Botões que o gestor vê no detalhe de cada estado. Desabilitado = a ação
 * existe, mas a API recusaria agora (o motivo aparece junto). Cada um
 * corresponde a uma célula 200 da matriz da API; os 422 não aparecem.
 */
const MANAGER_BUTTONS: Readonly<Record<keyof typeof STATES, readonly string[]>> = {
  pending: ['Iniciar preparo', 'Cancelar pedido'],
  preparing: ['Marcar como pronto', 'Cancelar pedido'],
  ready: ['Despachar (desabilitado)', 'Cancelar pedido'],
  'ready com entregador': ['Despachar', 'Cancelar pedido'],
  delivering: ['Confirmar entrega', 'Devolver para a atribuição'],
  'problema: cliente ausente': ['Tentar de novo', 'Cancelar entrega', 'Confirmar entrega (desabilitado)', 'Devolver para a atribuição'],
  'problema: cliente recusou': ['Cancelar entrega', 'Confirmar entrega (desabilitado)'],
  'problema depois de 2 novas tentativas': ['Cancelar entrega', 'Confirmar entrega (desabilitado)', 'Devolver para a atribuição'],
  delivered: [],
  cancelled: [],
};

function dto({ status, courier = false, issues = [], decisions = [] }: Scenario) {
  return toOrderDto(
    buildOrder({ status, deliveryPerson: courier ? COURIER : null, deliveryIssues: issues, deliveryIssueDecisions: decisions }),
  );
}

/** O detalhe do pedido: o painel do problema e as ações, como no modal. */
function renderDetailActions(scenario: Scenario, permissions?: readonly Permission[]) {
  const order = dto(scenario);
  return renderWithOrdering(
    <>
      <DeliveryIssuePanel order={order} />
      <OrderActions order={order} />
    </>,
    permissions === undefined ? {} : { permissions },
  );
}

function visibleButtons(): string[] {
  return screen
    .queryAllByRole('button')
    .map((button) => `${button.textContent?.trim() ?? ''}${(button as HTMLButtonElement).disabled ? ' (desabilitado)' : ''}`);
}

describe('Botões por estado do pedido (detalhe)', () => {
  it.each(Object.keys(STATES))('gestor, %s', (state) => {
    renderDetailActions(STATES[state] as Scenario);

    expect(visibleButtons()).toEqual(MANAGER_BUTTONS[state]);
  });

  it.each(Object.keys(STATES))('perfil somente leitura, %s: nenhum botão', (state) => {
    renderDetailActions(STATES[state] as Scenario, ['orders:read']);

    expect(visibleButtons()).toEqual([]);
  });
});
