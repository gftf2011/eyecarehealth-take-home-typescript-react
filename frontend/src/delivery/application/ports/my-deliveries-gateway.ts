import type { CourierIssueReason, GeoLocation, MyDeliveries } from '../../domain';
import type { RequestOptions } from './dispatch-board-gateway';

/**
 * As rotas do entregador logado (`/me/...`). A API descobre o entregador pelo
 * token e confere o dono de cada pedido: o painel nunca informa "quem sou eu".
 */
export interface MyDeliveriesGateway {
  load(options?: RequestOptions): Promise<MyDeliveries>;
  /** `delivering → delivered` do próprio pedido. */
  confirmDelivered(orderId: string): Promise<void>;
  updateLocation(location: GeoLocation): Promise<void>;
  /** Não conseguiu entregar: o pedido segue com ele até o gestor decidir. */
  reportIssue(orderId: string, issue: { readonly reason: CourierIssueReason; readonly note: string | null }): Promise<void>;
}
