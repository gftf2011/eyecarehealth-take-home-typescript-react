import type { Kysely } from 'kysely';

/**
 * Contexto do trace (W3C `traceparent`/`tracestate`) da requisição que gerou
 * o evento. O relay o leva até o SNS, e a mensagem chega ao gateway ainda no
 * mesmo trace: uma ação no painel vira um trace só pelos três processos.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('outbox_events').addColumn('trace_context', 'jsonb').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('outbox_events').dropColumn('trace_context').execute();
}
