import { z } from 'zod';

import type { Clock } from '../../shared-kernel/application';
import { AuthenticationError, type Permission } from '../../shared-kernel/domain';
import type { TokenAuthenticator, TokenPrincipal } from '../../shared-kernel/presentation';
import { CLOSE_CODES, type RealtimeConnection, type RealtimeEvent } from './realtime-protocol';

export type RealtimeSessionOptions = {
  /** Prazo para a mensagem de autenticação depois de conectar. */
  readonly authTimeoutMs: number;
  /** Permissão exigida para receber os eventos deste canal. */
  readonly requiredPermission: Permission;
  readonly clock: Clock;
};

/** Única mensagem que o cliente envia: o access token (inicial ou renovado). */
const clientMessageSchema = z.object({ type: z.literal('auth'), accessToken: z.string().min(1) });

type State =
  | { readonly kind: 'awaiting-auth' }
  | { readonly kind: 'authenticated'; readonly principal: TokenPrincipal }
  | { readonly kind: 'closed' };

/**
 * Ciclo de vida de uma conexão de tempo real, independente de WebSocket:
 *
 * 1. Conectou: tem `authTimeoutMs` para enviar `{ type: 'auth', accessToken }`
 *    (o navegador não envia `Authorization` em WebSocket, e token na URL
 *    vazaria em logs).
 * 2. Token válido e com permissão: responde `ready` e passa a receber eventos.
 * 3. O token vence: a conexão fecha com 4401. O cliente pode, antes disso,
 *    mandar outro `auth` com o token renovado e seguir conectado.
 */
export class RealtimeSession {
  #state: State = { kind: 'awaiting-auth' };
  #timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly connection: RealtimeConnection,
    private readonly authenticator: TokenAuthenticator,
    private readonly options: RealtimeSessionOptions,
  ) {}

  get isAuthenticated(): boolean {
    return this.#state.kind === 'authenticated';
  }

  get principal(): TokenPrincipal | null {
    return this.#state.kind === 'authenticated' ? this.#state.principal : null;
  }

  /** Começa a contar o prazo de autenticação. */
  start(): void {
    this.#schedule(this.options.authTimeoutMs, () =>
      this.#close(CLOSE_CODES.unauthorized, 'Autenticação não recebida no prazo'),
    );
  }

  /** Mensagem de texto recebida do cliente. */
  async receive(raw: string): Promise<void> {
    if (this.#state.kind === 'closed') return;

    const parsed = clientMessageSchema.safeParse(parseJson(raw));
    if (!parsed.success) {
      this.#close(CLOSE_CODES.invalidMessage, 'Mensagem fora do protocolo');
      return;
    }
    await this.#authenticate(parsed.data.accessToken);
  }

  /** Repassa um evento do broker; antes da autenticação, nada sai. */
  deliver(event: RealtimeEvent): void {
    if (this.#state.kind !== 'authenticated') return;
    this.connection.send({ type: 'event', ...event });
  }

  /** O socket fechou (por qualquer lado): libera os timers. */
  end(): void {
    this.#state = { kind: 'closed' };
    this.#clearTimer();
  }

  /** Encerramento pelo servidor (ex.: deploy). */
  shutdown(code: typeof CLOSE_CODES.serviceRestart, reason: string): void {
    this.#close(code, reason);
  }

  async #authenticate(accessToken: string): Promise<void> {
    let principal: TokenPrincipal;
    try {
      principal = await this.authenticator.authenticateToken(accessToken);
    } catch (error) {
      if (error instanceof AuthenticationError) this.#close(CLOSE_CODES.unauthorized, error.message);
      else this.#close(CLOSE_CODES.internalError, 'Erro ao autenticar');
      return;
    }
    // A conexão pode ter fechado enquanto o token era verificado.
    if (this.#state.kind === 'closed') return;

    if (!principal.permissions.includes(this.options.requiredPermission)) {
      this.#close(CLOSE_CODES.forbidden, 'Permissão insuficiente para este canal');
      return;
    }

    this.#state = { kind: 'authenticated', principal };
    const remainingMs = principal.expiresAt.getTime() - this.options.clock.now().getTime();
    this.#schedule(Math.max(remainingMs, 0), () => this.#close(CLOSE_CODES.unauthorized, 'Token expirado'));
    this.connection.send({ type: 'ready', expiresAt: principal.expiresAt.toISOString() });
  }

  #close(code: Parameters<RealtimeConnection['close']>[0], reason: string): void {
    if (this.#state.kind === 'closed') return;
    this.end();
    this.connection.close(code, reason);
  }

  #schedule(ms: number, action: () => void): void {
    this.#clearTimer();
    this.#timer = setTimeout(action, ms);
  }

  #clearTimer(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
