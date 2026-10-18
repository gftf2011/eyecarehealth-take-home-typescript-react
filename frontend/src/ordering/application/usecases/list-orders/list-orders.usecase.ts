import { mapPage, type Page, type UseCase } from '../../../../shared-kernel/application';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import { parseListOrdersInput, type ListOrdersInput } from '../../inputs/list-orders.input';
import type { OrderGateway, RequestOptions } from '../../ports/order-gateway';

/**
 * Lista pedidos com paginação, filtro por status e por dia de criação, e
 * ordenação. Filtros inválidos (ex.: data fim antes do início) são recusados
 * antes de chamar a API, com as mesmas mensagens dela.
 */
export class ListOrdersUseCase implements UseCase<ListOrdersInput & RequestOptions, Page<OrderDto>> {
  constructor(private readonly orders: OrderGateway) {}

  async execute({ signal, ...input }: ListOrdersInput & RequestOptions): Promise<Page<OrderDto>> {
    const criteria = parseListOrdersInput(input);
    const page = await this.orders.list(criteria, signal === undefined ? {} : { signal });
    return mapPage(page, toOrderDto);
  }
}
