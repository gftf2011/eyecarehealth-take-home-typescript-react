import type { Kysely, Transaction } from 'kysely';

import type { DomainEventBuffer, EventMediator } from '../../application';
import type { OutboxDatabase } from '../outbox/outbox-events.table';
import { KyselyOutboxWriter } from '../outbox/kysely-outbox.writer';

/** Efeitos que os handlers agendaram para depois do commit. */
export type AfterCommitEffects = (() => void)[];

/**
 * Publica no mediador os eventos coletados durante a transação, ainda dentro
 * dela: os handlers usam a mesma transação (ex.: outbox) e um erro deles
 * desfaz o caso de uso inteiro. Chamado pelas units of work antes do commit;
 * o que os handlers agendarem com `afterCommit` vai para `effects`.
 */
export async function publishCollectedEvents(
  mediator: EventMediator,
  events: DomainEventBuffer,
  trx: Transaction<OutboxDatabase> | Kysely<OutboxDatabase>,
  effects: AfterCommitEffects,
): Promise<void> {
  await mediator.publish(events.drain(), {
    outbox: new KyselyOutboxWriter(trx),
    afterCommit: (effect) => effects.push(effect),
  });
}

/**
 * Roda os efeitos depois do commit. Cada um isolado: uma métrica que falha
 * não derruba a requisição de um caso de uso que já deu certo.
 */
export function runAfterCommit(effects: AfterCommitEffects): void {
  for (const effect of effects) {
    try {
      effect();
    } catch {
      // Efeito acessório (observabilidade): nunca afeta o resultado.
    }
  }
}
