import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import { DeliveryPersonId } from '../../../domain';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type ReleaseDeliveryPersonOrdersInput = {
  readonly deliveryPersonId: string;
};

export type ReleaseDeliveryPersonOrdersResult = {
  /** Pedidos que perderam o entregador e voltaram para a atribuição. */
  readonly releasedOrderIds: readonly string[];
};

/**
 * Tira o entregador dos pedidos que ainda não saíram (`pending`, `preparing`,
 * `ready`) quando ele **não pode mais levá-los**: foi desativado ou removido
 * no Delivery. Os pedidos voltam para a fila de atribuição.
 *
 * Chamado pelo consumidor das mudanças da frota, mas quem decide é o estado
 * atual, lido na transação: se o entregador foi reativado depois da mensagem,
 * nada muda. Por isso pode rodar de novo (mensagem repetida) sem efeito.
 *
 * Ordem de lock: pedidos → entregador, a mesma do despacho e da atribuição
 * (sem deadlock entre eles). Um despacho concorrente termina antes (o pedido
 * sai de `ready` e não é tocado) ou espera e já encontra o entregador inativo.
 */
export class ReleaseDeliveryPersonOrdersUseCase
  implements UseCase<ReleaseDeliveryPersonOrdersInput, ReleaseDeliveryPersonOrdersResult>
{
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: ReleaseDeliveryPersonOrdersInput): Promise<ReleaseDeliveryPersonOrdersResult> {
    const { deliveryPersonId } = validateInput({
      deliveryPersonId: () => DeliveryPersonId.from(input.deliveryPersonId),
    });

    return this.unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
      const assigned = await orders.findUndispatchedAssignedToForUpdate(deliveryPersonId);
      if (assigned.length === 0) return { releasedOrderIds: [] };

      // `null`: removido. Ativo (mesmo ocupado com outra entrega) continua com os pedidos.
      const availability = await deliveryPersons.availabilityOf(deliveryPersonId);
      if (availability?.isActive === true) return { releasedOrderIds: [] };

      const now = this.clock.now();
      for (const order of assigned) {
        order.releaseDeliveryPerson(now);
        await orders.save(order);
      }
      return { releasedOrderIds: assigned.map((order) => order.id.value) };
    });
  }
}
