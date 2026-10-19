import type { CourierIssueReason, GeoLocation, MyDeliveries } from '../../domain';
import type { MyDeliveriesGateway } from '../ports/my-deliveries-gateway';

/** Gateway em memória das rotas do entregador: registra o que recebeu (já validado). */
export class FakeMyDeliveriesGateway implements MyDeliveriesGateway {
  readonly locations: GeoLocation[] = [];
  readonly confirmations: string[] = [];
  readonly issues: { orderId: string; reason: CourierIssueReason; note: string | null }[] = [];

  load(): Promise<MyDeliveries> {
    return Promise.resolve({ courier: { id: 'courier-1', name: 'Carlos Santos' }, inProgress: null, upcoming: [] });
  }

  confirmDelivered(orderId: string): Promise<void> {
    this.confirmations.push(orderId);
    return Promise.resolve();
  }

  updateLocation(location: GeoLocation): Promise<void> {
    this.locations.push(location);
    return Promise.resolve();
  }

  reportIssue(orderId: string, issue: { readonly reason: CourierIssueReason; readonly note: string | null }): Promise<void> {
    this.issues.push({ orderId, ...issue });
    return Promise.resolve();
  }
}
