import { z } from 'zod';

/**
 * Formato de `seed/data.json`. Valida só a estrutura e as referências por
 * índice; as regras dos valores (tamanhos, telefone, preço…) são dos casos de
 * uso, por onde o seed passa — dado inválido no arquivo falha com a mesma
 * mensagem da API.
 */
const seedDataSchema = z
  .object({
    users: z
      .array(
        z.object({
          email: z.string(),
          password: z.string(),
          role: z.string(),
          /** Só para `courier`: o entregador da frota com que este usuário entra. */
          deliveryPersonIndex: z.number().int().nonnegative().optional(),
        }),
      )
      .min(1),
    products: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        price: z.number(),
        category: z.string(),
        imageUrl: z.string().nullable().optional(),
        isAvailable: z.boolean().default(true),
        preparationTime: z.number(),
      }),
    ),
    deliveryPersons: z.array(
      z.object({
        name: z.string(),
        phone: z.string(),
        vehicleType: z.string(),
        isActive: z.boolean().default(true),
        currentLatitude: z.number().nullable().optional(),
        currentLongitude: z.number().nullable().optional(),
      }),
    ),
    orders: z.array(
      z.object({
        customerName: z.string(),
        customerPhone: z.string(),
        deliveryAddress: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        status: z.enum(['pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']),
        deliveryPersonIndex: z.number().int().nonnegative().optional(),
        items: z
          .array(z.object({ productIndex: z.number().int().nonnegative(), quantity: z.number() }))
          .min(1),
      }),
    ),
  })
  .superRefine((data, context) => {
    const linked = new Set<number>();
    data.users.forEach((user, userIndex) => {
      const path = ['users', userIndex, 'deliveryPersonIndex'];
      if (user.role === 'courier' && user.deliveryPersonIndex === undefined) {
        context.addIssue({ code: 'custom', path, message: 'Usuário courier precisa de deliveryPersonIndex' });
      }
      if (user.deliveryPersonIndex === undefined) return;
      if (user.role !== 'courier') {
        context.addIssue({ code: 'custom', path, message: 'Só usuários courier são vinculados a um entregador' });
      }
      if (user.deliveryPersonIndex >= data.deliveryPersons.length) {
        context.addIssue({
          code: 'custom',
          path,
          message: `Entregador ${user.deliveryPersonIndex} não existe (há ${data.deliveryPersons.length})`,
        });
      }
      if (linked.has(user.deliveryPersonIndex)) {
        context.addIssue({ code: 'custom', path, message: `Entregador ${user.deliveryPersonIndex} já tem um usuário` });
      }
      linked.add(user.deliveryPersonIndex);
    });

    data.orders.forEach((order, orderIndex) => {
      order.items.forEach((item, itemIndex) => {
        if (item.productIndex >= data.products.length) {
          context.addIssue({
            code: 'custom',
            path: ['orders', orderIndex, 'items', itemIndex, 'productIndex'],
            message: `Produto ${item.productIndex} não existe (há ${data.products.length})`,
          });
        }
      });

      const dispatched = order.status === 'delivering' || order.status === 'delivered';
      if (dispatched && order.deliveryPersonIndex === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['orders', orderIndex, 'deliveryPersonIndex'],
          message: `Pedido '${order.status}' precisa de deliveryPersonIndex`,
        });
      }
      if (order.deliveryPersonIndex !== undefined && order.deliveryPersonIndex >= data.deliveryPersons.length) {
        context.addIssue({
          code: 'custom',
          path: ['orders', orderIndex, 'deliveryPersonIndex'],
          message: `Entregador ${order.deliveryPersonIndex} não existe (há ${data.deliveryPersons.length})`,
        });
      }
    });
  });

export type SeedData = z.output<typeof seedDataSchema>;
export type SeedOrder = SeedData['orders'][number];

/** Valida o conteúdo do arquivo; falha apontando o caminho de cada problema. */
export function parseSeedData(raw: unknown): SeedData {
  const result = seedDataSchema.safeParse(raw);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`);
  throw new Error(`seed/data.json inválido:\n- ${problems.join('\n- ')}`);
}

/** `['orders', 3, 'items', 1]` → `orders[3].items[1]`. */
function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>(
    (formatted, key) => (typeof key === 'number' ? `${formatted}[${key}]` : formatted === '' ? String(key) : `${formatted}.${String(key)}`),
    '',
  );
}
