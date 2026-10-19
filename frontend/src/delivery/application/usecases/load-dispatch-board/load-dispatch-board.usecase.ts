import type { UseCase } from '../../../../shared-kernel/application';
import type { DispatchBoard } from '../../../domain';
import type { DispatchBoardGateway, RequestOptions } from '../../ports/dispatch-board-gateway';

/** Pedidos prontos e entregadores disponíveis, buscados em paralelo. */
export class LoadDispatchBoardUseCase implements UseCase<RequestOptions, DispatchBoard> {
  constructor(private readonly board: DispatchBoardGateway) {}

  async execute(options: RequestOptions = {}): Promise<DispatchBoard> {
    const [ready, couriers] = await Promise.all([
      this.board.readyOrders(options),
      this.board.availableCouriers(options),
    ]);
    return { readyOrders: ready.orders, hasMoreReadyOrders: ready.hasMore, availableCouriers: couriers };
  }
}
