import { z } from 'zod';

import type { JsonObject } from '../../shared-kernel/domain';
import type { RealtimeEvent } from '../application/realtime-protocol';

/** Envelope publicado pelo outbox relay (ver `MessageEnvelope`). */
const envelopeSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  occurredAt: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

/**
 * Converte a mensagem do broker no evento repassado aos clientes, ou `null`
 * se ela não seguir o envelope (descartada: nunca derruba as conexões).
 */
export function toRealtimeEvent(body: string): RealtimeEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { id, topic, occurredAt, payload } = parsed.data;
  // O payload veio de JSON.parse: é JSON puro por construção.
  return { id, topic, occurredAt, payload: payload as JsonObject };
}
