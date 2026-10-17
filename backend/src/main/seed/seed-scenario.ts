import type { UseCase } from '../../shared-kernel/application';
import type { CreateProductInput } from '../../catalog/application/usecases/create-product/create-product.usecase';
import type { UpdateProductInput } from '../../catalog/application/usecases/update-product/update-product.usecase';
import type { ProductDto } from '../../catalog/application/dtos/product.dto';
import type { DeliveryPersonDto } from '../../delivery/application/dtos/delivery-person.dto';
import type { RegisterDeliveryPersonInput } from '../../delivery/application/usecases/register-delivery-person/register-delivery-person.usecase';
import type { AuthenticatedUserDto } from '../../identity/application/dtos/auth-tokens.dto';
import type { RegisterUserInput } from '../../identity/application/usecases/register-user/register-user.usecase';
import type { OrderDto } from '../../ordering/application/dtos/order.dto';
import type { ChangeOrderStatusInput } from '../../ordering/application/usecases/change-order-status/change-order-status.usecase';
import type { DispatchOrderInput } from '../../ordering/application/usecases/dispatch-order/dispatch-order.usecase';
import type { PlaceOrderInput } from '../../ordering/application/usecases/place-order/place-order.usecase';
import { seededRandom, type SeedClock } from './seed-clock';
import type { SeedData, SeedOrder } from './seed-data';

/** Os casos de uso reais que o seed aciona (mesmas regras da API). */
export type SeedUseCases = {
  readonly registerUser: UseCase<RegisterUserInput, AuthenticatedUserDto>;
  readonly createProduct: UseCase<CreateProductInput, ProductDto>;
  readonly updateProduct: UseCase<UpdateProductInput, ProductDto>;
  readonly registerDeliveryPerson: UseCase<RegisterDeliveryPersonInput, DeliveryPersonDto>;
  readonly placeOrder: UseCase<PlaceOrderInput, OrderDto>;
  readonly changeOrderStatus: UseCase<ChangeOrderStatusInput, OrderDto>;
  readonly dispatchOrder: UseCase<DispatchOrderInput, OrderDto>;
};

export type SeedSummary = {
  readonly users: number;
  readonly products: number;
  readonly deliveryPersons: number;
  readonly orders: number;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Semente fixa: rodar de novo gera o mesmo cenário (relativo ao "agora"). */
const SCENARIO_SEED = 20_250_101;

/**
 * Popula o sistema passando pelos casos de uso, com horários plausíveis:
 * cadastros há 15 dias; pedidos finalizados espalhados pelas últimas duas
 * semanas; pedidos em andamento nas últimas duas horas. Cada pedido percorre
 * a máquina de estados até o status do arquivo, gerando o histórico real.
 */
export async function runSeedScenario(
  data: SeedData,
  useCases: SeedUseCases,
  clock: SeedClock,
  now: Date,
): Promise<SeedSummary> {
  const random = seededRandom(SCENARIO_SEED);
  const between = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));
  const setupAt = new Date(now.getTime() - 15 * DAY);
  /** Cadastros em sequência (1 min entre eles), para a ordem por data ser estável. */
  let setupStep = 0;
  const atSetup = (): void => clock.setTo(new Date(setupAt.getTime() + setupStep++ * MINUTE));

  for (const user of data.users) {
    atSetup();
    await useCases.registerUser.execute(user);
  }

  // Todos nascem disponíveis: pedido não aceita produto indisponível. Os
  // indisponíveis do arquivo são desligados depois dos pedidos.
  const productIds: string[] = [];
  for (const product of data.products) {
    atSetup();
    productIds.push((await useCases.createProduct.execute({ ...product, isAvailable: true })).id);
  }

  const deliveryPersonIds: string[] = [];
  for (const person of data.deliveryPersons) {
    atSetup();
    deliveryPersonIds.push((await useCases.registerDeliveryPerson.execute(person)).id);
  }

  for (const order of data.orders) {
    await seedOrder(order, startOf(order, now, between), productIds, deliveryPersonIds, useCases, clock, between);
  }

  for (const [index, product] of data.products.entries()) {
    const id = productIds[index];
    if (product.isAvailable || id === undefined) continue;
    clock.setTo(new Date(now.getTime() - DAY));
    await useCases.updateProduct.execute({ id, isAvailable: false });
  }

  return {
    users: data.users.length,
    products: data.products.length,
    deliveryPersons: data.deliveryPersons.length,
    orders: data.orders.length,
  };
}

/** Finalizados: 1 a 13 dias atrás, entre 11h e 21h; em andamento: há 1–2 horas. */
function startOf(order: SeedOrder, now: Date, between: (min: number, max: number) => number): Date {
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return new Date(now.getTime() - between(1, 13) * DAY - between(3 * 60, 13 * 60) * MINUTE);
  }
  return new Date(now.getTime() - between(60, 120) * MINUTE);
}

async function seedOrder(
  order: SeedOrder,
  createdAt: Date,
  productIds: readonly string[],
  deliveryPersonIds: readonly string[],
  useCases: SeedUseCases,
  clock: SeedClock,
  between: (min: number, max: number) => number,
): Promise<void> {
  let at = createdAt.getTime();
  const step = (minMinutes: number, maxMinutes: number): void => {
    at += between(minMinutes, maxMinutes) * MINUTE;
    clock.setTo(new Date(at));
  };

  clock.setTo(createdAt);
  const { id } = await useCases.placeOrder.execute({
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    latitude: order.latitude,
    longitude: order.longitude,
    items: order.items.map((item) => ({ productId: productIdAt(productIds, item.productIndex), quantity: item.quantity })),
  });
  const changeStatus = (status: string) => useCases.changeOrderStatus.execute({ id, status });

  if (order.status === 'pending') return;
  if (order.status === 'cancelled') {
    step(3, 15);
    await changeStatus('cancelled');
    return;
  }

  step(2, 5);
  await changeStatus('preparing');
  if (order.status === 'preparing') return;

  step(10, 25);
  await changeStatus('ready');
  if (order.status === 'ready') return;

  step(2, 8);
  const deliveryPersonId = deliveryPersonIds[order.deliveryPersonIndex ?? -1];
  if (deliveryPersonId === undefined) throw new Error(`Pedido '${order.status}' sem entregador válido`);
  await useCases.dispatchOrder.execute({ id, deliveryPersonId });
  if (order.status === 'delivering') return;

  step(15, 45);
  await changeStatus('delivered');
}

function productIdAt(productIds: readonly string[], index: number): string {
  const id = productIds[index];
  if (id === undefined) throw new Error(`Produto ${index} não existe`);
  return id;
}
