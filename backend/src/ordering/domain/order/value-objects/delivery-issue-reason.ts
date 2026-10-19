import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidDeliveryIssueReasonError } from '../errors';

export const DELIVERY_ISSUE_REASONS = ['customer_absent', 'address_not_found', 'refused', 'other'] as const;

export type DeliveryIssueReasonValue = (typeof DELIVERY_ISSUE_REASONS)[number];

/** O que o gestor pode decidir sobre uma entrega que falhou. */
export const DELIVERY_ISSUE_DECISIONS = ['retry', 'return', 'cancel'] as const;

export type DeliveryIssueDecision = (typeof DELIVERY_ISSUE_DECISIONS)[number];

/**
 * Cliente que recusou não recebe de novo nem tem o pedido redespachado: só
 * cancelar. Nos outros motivos, o gestor escolhe.
 */
const DECISIONS_BY_REASON: Readonly<Record<DeliveryIssueReasonValue, readonly DeliveryIssueDecision[]>> = {
  customer_absent: DELIVERY_ISSUE_DECISIONS,
  address_not_found: DELIVERY_ISSUE_DECISIONS,
  refused: ['cancel'],
  other: DELIVERY_ISSUE_DECISIONS,
};

const REASON_DESCRIPTIONS: Readonly<Record<DeliveryIssueReasonValue, string>> = {
  customer_absent: 'cliente ausente',
  address_not_found: 'endereço não encontrado',
  refused: 'cliente recusou',
  other: 'outro motivo',
};

/** Por que o entregador não conseguiu entregar. `other` exige uma observação. */
export class DeliveryIssueReason extends ValueObject<{ value: DeliveryIssueReasonValue }> {
  private constructor(value: DeliveryIssueReasonValue) {
    super({ value });
  }

  static create(raw: string): DeliveryIssueReason {
    if (!(DELIVERY_ISSUE_REASONS as readonly string[]).includes(raw)) {
      throw new InvalidDeliveryIssueReasonError(`O motivo deve ser um de: ${DELIVERY_ISSUE_REASONS.join(', ')}`);
    }
    return new DeliveryIssueReason(raw as DeliveryIssueReasonValue);
  }

  get value(): DeliveryIssueReasonValue {
    return this.props.value;
  }

  /** Como o motivo aparece no histórico do pedido. */
  get description(): string {
    return REASON_DESCRIPTIONS[this.props.value];
  }

  /** Decisões que o motivo permite (sem contar o limite de tentativas). */
  get decisions(): readonly DeliveryIssueDecision[] {
    return DECISIONS_BY_REASON[this.props.value];
  }

  get requiresNote(): boolean {
    return this.props.value === 'other';
  }
}
