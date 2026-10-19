import { DeliveryIssueAlreadyOpenError, DeliveryIssueDecisionNotAllowedError, NoOpenDeliveryIssueError } from '../errors';
import type { DeliveryIssueNote } from '../value-objects/delivery-issue-note';
import type { DeliveryIssueDecision, DeliveryIssueReason } from '../value-objects/delivery-issue-reason';
import type { DeliveryPersonId } from '../value-objects/delivery-person-id';
import { DeliveryIssue, type DeliveryIssueResolution } from './delivery-issue';
import type { DeliveryIssueId } from './delivery-issue-id';

/** Quantas vezes o gestor pode mandar tentar de novo o mesmo pedido; depois, só devolver ou cancelar. */
export const MAX_DELIVERY_RETRIES = 2;

const DECISION_FOR: Readonly<Record<DeliveryIssueResolution, DeliveryIssueDecision>> = {
  retried: 'retry',
  returned: 'return',
  cancelled: 'cancel',
};

/**
 * As tentativas de entrega que falharam, na ordem. Imutável: relatar e
 * resolver devolvem um registro novo (o agregado troca o dele). Garante no
 * máximo um problema aberto por vez.
 */
export class DeliveryIssueLog {
  private constructor(readonly issues: readonly DeliveryIssue[]) {}

  static of(issues: readonly DeliveryIssue[]): DeliveryIssueLog {
    return new DeliveryIssueLog([...issues]);
  }

  get open(): DeliveryIssue | null {
    return this.issues.find((issue) => issue.isOpen) ?? null;
  }

  /**
   * O que o gestor pode decidir agora sobre o problema aberto: o que o motivo
   * permite, sem "tentar de novo" depois de `MAX_DELIVERY_RETRIES`. Vazio se
   * não há problema aberto.
   */
  get decisions(): readonly DeliveryIssueDecision[] {
    const open = this.open;
    if (open === null) return [];
    const retries = this.issues.filter((issue) => issue.resolution === 'retried').length;
    return open.reason.decisions.filter((decision) => decision !== 'retry' || retries < MAX_DELIVERY_RETRIES);
  }

  report(params: {
    id: DeliveryIssueId;
    reason: DeliveryIssueReason;
    note: DeliveryIssueNote | null;
    reportedBy: DeliveryPersonId;
    now: Date;
  }): { readonly log: DeliveryIssueLog; readonly issue: DeliveryIssue } {
    if (this.open !== null) throw new DeliveryIssueAlreadyOpenError();
    const issue = DeliveryIssue.report(params);
    return { log: new DeliveryIssueLog([...this.issues, issue]), issue };
  }

  /** Resolve o problema aberto; devolve o registro novo e o problema como era. */
  resolveOpen(
    resolution: DeliveryIssueResolution,
    now: Date,
  ): { readonly log: DeliveryIssueLog; readonly issue: DeliveryIssue } {
    const open = this.open;
    if (open === null) throw new NoOpenDeliveryIssueError();
    this.ensureAllowed(DECISION_FOR[resolution], open);
    const resolved = open.resolved(resolution, now);
    return {
      log: new DeliveryIssueLog(this.issues.map((issue) => (issue.id.equals(open.id) ? resolved : issue))),
      issue: open,
    };
  }

  private ensureAllowed(decision: DeliveryIssueDecision, open: DeliveryIssue): void {
    if (this.decisions.includes(decision)) return;
    if (!open.reason.decisions.includes(decision)) {
      throw new DeliveryIssueDecisionNotAllowedError(
        decision,
        decision === 'retry' ? 'tentar de novo quando o cliente recusou o pedido' : 'devolver para a atribuição um pedido que o cliente recusou',
      );
    }
    throw new DeliveryIssueDecisionNotAllowedError(
      decision,
      `tentar de novo mais de ${MAX_DELIVERY_RETRIES} vezes: devolva para a atribuição ou cancele`,
    );
  }
}
