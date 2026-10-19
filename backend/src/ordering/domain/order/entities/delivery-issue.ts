import { Entity } from '../../../../shared-kernel/domain';
import { InvalidDeliveryIssueNoteError } from '../errors';
import type { DeliveryIssueNote } from '../value-objects/delivery-issue-note';
import type { DeliveryIssueReason } from '../value-objects/delivery-issue-reason';
import type { DeliveryPersonId } from '../value-objects/delivery-person-id';
import type { DeliveryIssueId } from './delivery-issue-id';

/** Como o problema terminou: sempre por decisão do gestor. */
export const DELIVERY_ISSUE_RESOLUTIONS = ['retried', 'returned', 'cancelled'] as const;

export type DeliveryIssueResolution = (typeof DELIVERY_ISSUE_RESOLUTIONS)[number];

export type DeliveryIssueSnapshot = {
  reason: DeliveryIssueReason;
  note: DeliveryIssueNote | null;
  /** Quem relatou (o entregador da entrega). */
  reportedBy: DeliveryPersonId;
  reportedAt: Date;
  resolvedAt: Date | null;
  resolution: DeliveryIssueResolution | null;
};

/**
 * Uma tentativa de entrega que falhou, relatada pelo entregador. Entidade
 * interna do agregado Order: só a raiz cria e resolve. Fica no pedido mesmo
 * depois de resolvida (o histórico das tentativas).
 */
export class DeliveryIssue extends Entity<DeliveryIssueId> {
  readonly #props: DeliveryIssueSnapshot;

  private constructor(id: DeliveryIssueId, props: DeliveryIssueSnapshot) {
    super(id);
    this.#props = props;
  }

  static report(params: {
    id: DeliveryIssueId;
    reason: DeliveryIssueReason;
    note: DeliveryIssueNote | null;
    reportedBy: DeliveryPersonId;
    now: Date;
  }): DeliveryIssue {
    if (params.reason.requiresNote && params.note === null) {
      throw new InvalidDeliveryIssueNoteError('Descreva o problema quando o motivo for "outro"');
    }
    return new DeliveryIssue(params.id, {
      reason: params.reason,
      note: params.note,
      reportedBy: params.reportedBy,
      reportedAt: new Date(params.now.getTime()),
      resolvedAt: null,
      resolution: null,
    });
  }

  static reconstitute(id: DeliveryIssueId, snapshot: DeliveryIssueSnapshot): DeliveryIssue {
    return new DeliveryIssue(id, { ...snapshot });
  }

  get reason(): DeliveryIssueReason {
    return this.#props.reason;
  }

  get note(): DeliveryIssueNote | null {
    return this.#props.note;
  }

  get reportedBy(): DeliveryPersonId {
    return this.#props.reportedBy;
  }

  get reportedAt(): Date {
    return new Date(this.#props.reportedAt.getTime());
  }

  get resolvedAt(): Date | null {
    return this.#props.resolvedAt === null ? null : new Date(this.#props.resolvedAt.getTime());
  }

  get resolution(): DeliveryIssueResolution | null {
    return this.#props.resolution;
  }

  get isOpen(): boolean {
    return this.#props.resolvedAt === null;
  }

  /** O mesmo problema, resolvido. Imutável: só a raiz troca um pelo outro. */
  resolved(resolution: DeliveryIssueResolution, now: Date): DeliveryIssue {
    return new DeliveryIssue(this.id, { ...this.#props, resolution, resolvedAt: new Date(now.getTime()) });
  }

  snapshot(): DeliveryIssueSnapshot {
    return { ...this.#props, reportedAt: this.reportedAt, resolvedAt: this.resolvedAt };
  }
}
