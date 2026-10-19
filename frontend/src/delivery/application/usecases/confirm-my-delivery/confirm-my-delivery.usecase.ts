import type { UseCase } from '../../../../shared-kernel/application';
import type { MyDeliveriesGateway } from '../../ports/my-deliveries-gateway';

export type ConfirmMyDeliveryInput = { readonly orderId: string };

/**
 * O entregador confirma que entregou. Se o gestor já tiver mexido no pedido
 * (devolveu para a atribuição, por exemplo), a API recusa com `404`/`422` e a
 * tela recarrega.
 */
export class ConfirmMyDeliveryUseCase implements UseCase<ConfirmMyDeliveryInput, void> {
  constructor(private readonly deliveries: MyDeliveriesGateway) {}

  execute({ orderId }: ConfirmMyDeliveryInput): Promise<void> {
    return this.deliveries.confirmDelivered(orderId);
  }
}
