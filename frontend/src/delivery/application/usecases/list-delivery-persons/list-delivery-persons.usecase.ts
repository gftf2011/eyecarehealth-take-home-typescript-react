import type { UseCase } from '../../../../shared-kernel/application';
import { toDeliveryPersonDto, type DeliveryPersonDto } from '../../dtos/delivery-person.dto';
import {
  parseListDeliveryPersonsInput,
  type ListDeliveryPersonsInput,
} from '../../inputs/list-delivery-persons.input';
import type { DeliveryPersonGateway } from '../../ports/delivery-person-gateway';
import type { RequestOptions } from '../../ports/dispatch-board-gateway';

/**
 * Lista a frota (sem os removidos), com filtros de ativação e de entrega em
 * andamento. A API devolve a frota inteira: ela é pequena, sem paginação.
 */
export class ListDeliveryPersonsUseCase
  implements UseCase<ListDeliveryPersonsInput & RequestOptions, readonly DeliveryPersonDto[]>
{
  constructor(private readonly deliveryPersons: DeliveryPersonGateway) {}

  async execute({ signal, ...input }: ListDeliveryPersonsInput & RequestOptions): Promise<readonly DeliveryPersonDto[]> {
    const criteria = parseListDeliveryPersonsInput(input);
    const persons = await this.deliveryPersons.list(criteria, signal === undefined ? {} : { signal });
    return persons.map(toDeliveryPersonDto);
  }
}
