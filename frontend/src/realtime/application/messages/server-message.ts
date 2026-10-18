import { z } from 'zod';

/** Mensagens do gateway para o painel (o mesmo contrato do backend). */
const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), expiresAt: z.string() }),
  z.object({
    type: z.literal('event'),
    id: z.string().min(1),
    topic: z.string().min(1),
    occurredAt: z.string(),
    payload: z.record(z.string(), z.unknown()),
  }),
]);

export type ServerMessage = z.output<typeof serverMessageSchema>;

/** Mensagem válida, ou `null` para texto fora do protocolo (ignorado, nunca derruba o painel). */
export function parseServerMessage(text: string): ServerMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = serverMessageSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** Única mensagem que o painel envia: o access token (inicial ou renovado). */
export function authMessage(accessToken: string): string {
  return JSON.stringify({ type: 'auth', accessToken });
}
