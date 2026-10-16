import {
  validateInput,
  type Clock,
  type UseCase,
} from '../../../../shared-kernel/application';
import {
  CustomerName,
  DeliveryAddress,
  GeoLocation,
  Order,
  OrderId,
  PhoneNumber,
  type PlaceOrderItem,
  type ProductId,
  type ProductSnapshot,
} from '../../../domain';
import { toOrderDto, type OrderDto } from '../../dtos/order.dto';
import { UnknownProductsError } from '../../errors/unknown-products.error';
import {
  parseOrderItemsInput,
  type OrderItemInput,
  type ParsedOrderItem,
} from '../../inputs/order-items.input';
import type { OrderingUnitOfWork } from '../../ports/ordering-unit-of-work';

export type PlaceOrderInput = {
  readonly customerName: string;
  readonly customerPhone: string;
  readonly deliveryAddress: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly items: readonly OrderItemInput[];
};

/**
 * Registra um pedido `pending`. Os preços vêm do Catalog no momento do pedido
 * (snapshot em `unitPrice`) e o `totalAmount` é sempre calculado pelo agregado,
 * nunca informado pelo cliente. Produtos inexistentes, removidos ou
 * indisponíveis impedem o pedido.
 */
export class PlaceOrderUseCase implements UseCase<PlaceOrderInput, OrderDto> {
  constructor(
    private readonly unitOfWork: OrderingUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: PlaceOrderInput): Promise<OrderDto> {
    const validated = validateInput({
      customerName: () => CustomerName.create(input.customerName),
      customerPhone: () => PhoneNumber.create(input.customerPhone),
      deliveryAddress: () => DeliveryAddress.create(input.deliveryAddress),
      location: () => GeoLocation.create(input.latitude, input.longitude),
      items: () => parseOrderItemsInput(input.items),
    });
    const productIds = uniqueProductIds(validated.items);

    return this.unitOfWork.transaction(async ({ orders, products }) => {
      const snapshots = new Map(
        (await products.snapshotsOf(productIds)).map((snapshot) => [snapshot.productId.value, snapshot]),
      );

      const order = Order.place({
        id: OrderId.generate(),
        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        deliveryAddress: validated.deliveryAddress,
        location: validated.location,
        items: withSnapshots(validated.items, productIds, snapshots),
        now: this.clock.now(),
      });

      await orders.save(order);
      return toOrderDto(order, new Map());
    });
  }
}

/** O mesmo produto pode vir repetido; o Catalog é consultado uma vez por ID. */
function uniqueProductIds(items: readonly ParsedOrderItem[]): ProductId[] {
  const unique = new Map<string, ProductId>();
  for (const item of items) unique.set(item.productId.value, item.productId);
  return [...unique.values()];
}

/** Liga cada item ao snapshot do Catalog; lista de uma vez todos os produtos desconhecidos. */
function withSnapshots(
  items: readonly ParsedOrderItem[],
  productIds: readonly ProductId[],
  snapshots: ReadonlyMap<string, ProductSnapshot>,
): PlaceOrderItem[] {
  const unknown = productIds.filter((id) => !snapshots.has(id.value));
  if (unknown.length > 0) throw new UnknownProductsError(unknown);

  return items.flatMap((item) => {
    const product = snapshots.get(item.productId.value);
    return product === undefined ? [] : [{ product, quantity: item.quantity }];
  });
}
