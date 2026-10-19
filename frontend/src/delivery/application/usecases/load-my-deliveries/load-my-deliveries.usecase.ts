import type { UseCase } from '../../../../shared-kernel/application';
import type { MyDeliveries } from '../../../domain';
import type { RequestOptions } from '../../ports/dispatch-board-gateway';
import type { MyDeliveriesGateway } from '../../ports/my-deliveries-gateway';

/** A entrega em andamento e as próximas do entregador logado. */
export class LoadMyDeliveriesUseCase implements UseCase<RequestOptions, MyDeliveries> {
  constructor(private readonly deliveries: MyDeliveriesGateway) {}

  execute(options: RequestOptions = {}): Promise<MyDeliveries> {
    return this.deliveries.load(options);
  }
}
