import { ws } from 'msw';

import { TEST_REALTIME_URL } from '../../../shared-kernel/infra/testing/test-api';

const ORDER_UPDATES_TOPIC = 'ordering.order-updates';
const PRODUCT_UPDATES_TOPIC = 'catalog.product-updates';
const DELIVERY_PERSON_UPDATES_TOPIC = 'delivery.delivery-person-updates';

type Client = Parameters<Parameters<ReturnType<typeof ws.link>['addEventListener']>[1]>[0]['client'];

/**
 * Imitação do gateway de tempo real com o protocolo do backend: autenticação
 * pela primeira mensagem, `ready`, eventos e fechamento com os códigos reais.
 */
export class FakeRealtimeGateway {
  readonly #link = ws.link(TEST_REALTIME_URL);
  readonly #clients = new Set<Client>();
  readonly authTokens: string[] = [];
  connections = 0;
  #sequence = 0;
  #held: (() => void)[] | null = null;

  handler() {
    return this.#link.addEventListener('connection', ({ client }) => {
      this.connections += 1;
      client.addEventListener('message', (message) => {
        if (typeof message.data !== 'string') return;
        const parsed = JSON.parse(message.data) as { type?: string; accessToken?: string };
        if (parsed.type !== 'auth' || parsed.accessToken === undefined) return;
        this.authTokens.push(parsed.accessToken);
        const ready = () => {
          this.#clients.add(client);
          client.send(JSON.stringify({ type: 'ready', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() }));
        };
        if (this.#held === null) ready();
        else this.#held.push(ready);
      });
      client.addEventListener('close', () => {
        this.#clients.delete(client);
      });
    });
  }

  /** Conexões assinadas (que já receberam `ready`). */
  get openConnections(): number {
    return this.#clients.size;
  }

  /**
   * Segura o `ready` (a assinatura no pub/sub) até `releaseReady()`: o que for
   * publicado nesse meio-tempo não chega ao painel, como no gateway real.
   */
  holdReady(): void {
    this.#held ??= [];
  }

  releaseReady(): void {
    const held = this.#held ?? [];
    this.#held = null;
    for (const ready of held) ready();
  }

  /** Publica uma atualização de pedido para todos os painéis conectados. */
  publishOrderUpdate(payload: Record<string, unknown>, id?: string): void {
    this.publish(ORDER_UPDATES_TOPIC, payload, id);
  }

  /** Publica uma mudança no cardápio para todos os painéis conectados. */
  publishProductUpdate(payload: Record<string, unknown>, id?: string): void {
    this.publish(PRODUCT_UPDATES_TOPIC, payload, id);
  }

  /** Publica uma mudança na frota para todos os painéis conectados. */
  publishDeliveryPersonUpdate(payload: Record<string, unknown>, id?: string): void {
    this.publish(DELIVERY_PERSON_UPDATES_TOPIC, payload, id);
  }

  publish(topic: string, payload: Record<string, unknown>, id = `evt-${(this.#sequence += 1)}`): void {
    const message = { type: 'event', id, topic, occurredAt: new Date().toISOString(), payload };
    for (const client of this.#clients) client.send(JSON.stringify(message));
  }

  /** O gateway reinicia (deploy): fecha todas as conexões com 1012. */
  restart(): void {
    for (const client of [...this.#clients]) client.close(1012, 'Servidor reiniciando');
  }
}
