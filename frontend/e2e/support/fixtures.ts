import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test';

/** Usuários do `seed/data.json` (credenciais de desenvolvimento, documentadas no README). */
export const USERS = {
  admin: { email: 'admin@fastmeals.com', password: 'Admin@123' },
  viewer: { email: 'viewer@fastmeals.com', password: 'Viewer@123' },
} as const;

export type SeedUser = (typeof USERS)[keyof typeof USERS];

/** Nome único por teste: a suíte roda contra um banco só e nunca colide consigo mesma. */
export function unique(label: string): string {
  return `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/**
 * Entra pela API no contexto da página: o cookie `httpOnly` do refresh token
 * fica no navegador, e a próxima navegação restaura a sessão como num reload.
 * Cada teste tem a própria sessão — reaproveitar um cookie salvo entre testes
 * dispararia a detecção de reuso do refresh token rotativo.
 */
export async function signIn(page: Page, user: SeedUser = USERS.admin): Promise<void> {
  const response = await page.request.post('/api/auth/login', { data: user });
  expect(response.ok(), `login de ${user.email}`).toBe(true);
}

type ProductInput = {
  name: string;
  price?: number;
  category?: 'meal' | 'drink' | 'dessert' | 'side';
  isAvailable?: boolean;
};

export type CreatedProduct = { id: string; name: string; isAvailable: boolean };
export type CreatedOrder = { id: string; customerName: string; status: string };
export type CreatedDeliveryPerson = { id: string; name: string };

/** Cliente da API para preparar dados de teste (fora do navegador, com o próprio token). */
export class FastMealsApi {
  private constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  static async signIn(request: APIRequestContext, user: SeedUser = USERS.admin): Promise<FastMealsApi> {
    const response = await request.post('/api/auth/login', { data: user });
    expect(response.ok(), `login de ${user.email} pela API`).toBe(true);
    const { accessToken } = (await response.json()) as { accessToken: string };
    return new FastMealsApi(request, accessToken);
  }

  async createProduct({ name, price = 29.9, category = 'meal', isAvailable = true }: ProductInput): Promise<CreatedProduct> {
    const response = await this.request.post('/api/products', {
      headers: this.#auth(),
      data: {
        name,
        description: 'Produto criado pelo teste de ponta a ponta',
        price,
        category,
        isAvailable,
        preparationTime: 15,
        imageUrl: null,
      },
    });
    expect(response.status(), `criar produto ${name}`).toBe(201);
    return (await response.json()) as CreatedProduct;
  }

  async setAvailability(productId: string, isAvailable: boolean): Promise<void> {
    const response = await this.request.put(`/api/products/${productId}`, {
      headers: this.#auth(),
      data: { isAvailable },
    });
    expect(response.ok(), 'mudar disponibilidade').toBe(true);
  }

  /** Pedido `pending` de um produto novo, criado só para o teste. */
  async placeOrder(customerName: string): Promise<CreatedOrder> {
    const product = await this.createProduct({ name: unique('Prato do pedido') });
    const response = await this.request.post('/api/orders', {
      headers: this.#auth(),
      data: {
        customerName,
        customerPhone: '(11) 98888-7777',
        deliveryAddress: 'Rua dos Testes, 42, Vila Mariana, Sao Paulo - SP',
        latitude: -23.5891,
        longitude: -46.6378,
        items: [{ productId: product.id, quantity: 2 }],
      },
    });
    expect(response.status(), `criar pedido de ${customerName}`).toBe(201);
    return (await response.json()) as CreatedOrder;
  }

  async changeStatus(orderId: string, status: string): Promise<void> {
    const response = await this.request.patch(`/api/orders/${orderId}/status`, {
      headers: this.#auth(),
      data: { status },
    });
    expect(response.ok(), `mudar status para ${status}`).toBe(true);
  }

  /** Entregador ativo e livre, criado só para o teste. */
  async registerDeliveryPerson(name: string): Promise<CreatedDeliveryPerson> {
    const response = await this.request.post('/api/delivery-persons', {
      headers: this.#auth(),
      data: {
        name,
        phone: '(11) 97777-1234',
        vehicleType: 'motorcycle',
        currentLatitude: -23.5614,
        currentLongitude: -46.6559,
      },
    });
    expect(response.status(), `cadastrar entregador ${name}`).toBe(201);
    return (await response.json()) as CreatedDeliveryPerson;
  }

  async removeDeliveryPerson(id: string): Promise<void> {
    const response = await this.request.delete(`/api/delivery-persons/${id}`, { headers: this.#auth() });
    expect(response.status(), 'remover entregador').toBe(204);
  }

  /** Despacha um pedido `ready` com o entregador (o pedido vai para `delivering`). */
  async dispatch(orderId: string, deliveryPersonId: string): Promise<void> {
    const response = await this.request.post(`/api/orders/${orderId}/dispatch`, {
      headers: this.#auth(),
      data: { deliveryPersonId },
    });
    expect(response.ok(), 'despachar pedido').toBe(true);
  }

  #auth(): Record<string, string> {
    return { authorization: `Bearer ${this.token}` };
  }
}

type Fixtures = {
  /** API autenticada como admin, para preparar o cenário do teste. */
  api: FastMealsApi;
};

export const test = base.extend<Fixtures>({
  api: async ({ playwright, baseURL }, use) => {
    const request = await playwright.request.newContext({ ...(baseURL !== undefined && { baseURL }) });
    await use(await FastMealsApi.signIn(request));
    await request.dispose();
  },
});

export { expect };
