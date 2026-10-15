# Especificacao da API — FastMeals

Todas as rotas possuem o prefixo `/api`.

Formato de resposta padrao: `application/json`.

---

## Autenticacao

### POST /api/auth/login

Autentica um usuario e retorna os tokens.

**Request Body:**
```json
{
  "email": "admin@fastmeals.com",
  "password": "Admin@123"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "admin@fastmeals.com",
    "role": "admin"
  }
}
```

**Response 401:**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email ou senha invalidos"
  }
}
```

---

### POST /api/auth/refresh

Gera um novo access token a partir de um refresh token valido.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 401:**
```json
{
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh token invalido ou expirado"
  }
}
```

---

## Produtos

> Todas as rotas abaixo requerem autenticacao (header `Authorization: Bearer <accessToken>`).
> Rotas de escrita (POST, PUT, DELETE) requerem perfil `admin`.

### GET /api/products

Lista produtos com paginacao, busca e filtros.

**Query Parameters:**

| Parametro      | Tipo    | Obrigatorio | Descricao                                      |
| -------------- | ------- | ----------- | ---------------------------------------------- |
| `page`         | integer | Nao         | Pagina atual (default: 1)                      |
| `limit`        | integer | Nao         | Itens por pagina (default: 20, max: 100)       |
| `search`       | string  | Nao         | Busca por nome (case-insensitive, parcial)     |
| `category`     | string  | Nao         | Filtro por categoria (ex: `meal`, `drink`)     |
| `isAvailable`  | boolean | Nao         | Filtro por disponibilidade                     |
| `sortBy`       | string  | Nao         | Campo de ordenacao: `name`, `price`, `createdAt` (default: `createdAt`) |
| `sortOrder`    | string  | Nao         | `asc` ou `desc` (default: `desc`)              |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "X-Burger Especial",
      "description": "Hamburguer artesanal com queijo cheddar...",
      "price": 32.90,
      "category": "meal",
      "imageUrl": "https://example.com/burger.jpg",
      "isAvailable": true,
      "preparationTime": 25,
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3
  }
}
```

---

### GET /api/products/:id

Retorna um produto pelo ID.

**Response 200:** Objeto do produto (mesmo formato da listagem).

**Response 404:**
```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Produto nao encontrado"
  }
}
```

---

### POST /api/products

Cria um novo produto. **Requer perfil `admin`.**

**Request Body:**
```json
{
  "name": "Suco de Laranja Natural",
  "description": "Suco de laranja natural, feito na hora, 500ml",
  "price": 12.50,
  "category": "drink",
  "imageUrl": "https://example.com/suco.jpg",
  "preparationTime": 5
}
```

**Response 201:** Objeto do produto criado.

**Response 400:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados invalidos",
    "details": [
      { "field": "name", "message": "O nome deve ter entre 3 e 120 caracteres" },
      { "field": "price", "message": "O preco deve ser maior que zero" }
    ]
  }
}
```

---

### PUT /api/products/:id

Atualiza um produto existente. **Requer perfil `admin`.**

**Request Body:** Mesmo formato do POST (todos os campos que serao atualizados).

**Response 200:** Objeto do produto atualizado.

**Response 404:** Produto nao encontrado.

---

### DELETE /api/products/:id

Remove um produto. **Requer perfil `admin`.**

**Response 204:** Sem corpo (produto deletado com sucesso).

**Response 409:**
```json
{
  "error": {
    "code": "PRODUCT_IN_USE",
    "message": "Nao e possivel deletar este produto pois ele esta vinculado a pedidos com status 'pending' ou 'preparing'"
  }
}
```

---

## Pedidos

> Todas as rotas requerem autenticacao.
> Criacao e alteracao de status requerem perfil `admin`.

### GET /api/orders

Lista pedidos com paginacao e filtros.

**Query Parameters:**

| Parametro   | Tipo    | Obrigatorio | Descricao                                         |
| ----------- | ------- | ----------- | ------------------------------------------------- |
| `page`      | integer | Nao         | Pagina atual (default: 1)                         |
| `limit`     | integer | Nao         | Itens por pagina (default: 20, max: 100)          |
| `status`    | string  | Nao         | Filtro por status (ex: `pending`, `delivering`)   |
| `sortBy`    | string  | Nao         | `createdAt` ou `totalAmount` (default: `createdAt`) |
| `sortOrder` | string  | Nao         | `asc` ou `desc` (default: `desc`)                 |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "customerName": "Joao Silva",
      "customerPhone": "(11) 99999-1234",
      "deliveryAddress": "Rua das Flores, 123, Sao Paulo - SP",
      "latitude": -23.5505,
      "longitude": -46.6333,
      "status": "pending",
      "totalAmount": 65.80,
      "deliveryPerson": null,
      "items": [
        {
          "id": "uuid",
          "product": {
            "id": "uuid",
            "name": "X-Burger Especial"
          },
          "quantity": 2,
          "unitPrice": 32.90
        }
      ],
      "createdAt": "2025-01-20T14:30:00Z",
      "updatedAt": "2025-01-20T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
  }
}
```

---

### GET /api/orders/:id

Retorna detalhes de um pedido especifico.

**Response 200:** Objeto completo do pedido (mesmo formato da listagem).

---

### POST /api/orders

Cria um novo pedido. **Requer perfil `admin`.**

**Request Body:**
```json
{
  "customerName": "Maria Oliveira",
  "customerPhone": "(21) 98765-4321",
  "deliveryAddress": "Av. Brasil, 456, Rio de Janeiro - RJ",
  "latitude": -22.9068,
  "longitude": -43.1729,
  "items": [
    { "productId": "uuid-do-produto", "quantity": 2 },
    { "productId": "uuid-de-outro-produto", "quantity": 1 }
  ]
}
```

**Comportamento:**
- O backend deve calcular o `totalAmount` com base nos precos atuais dos produtos
- O `unitPrice` de cada item deve ser registrado no momento da criacao (snapshot do preco)
- Status inicial: `pending`
- Todos os produtos devem existir e estar disponiveis (`isAvailable = true`)

**Response 201:** Objeto do pedido criado (com `totalAmount` calculado).

**Response 400:** Validacao de campos.

**Response 422:**
```json
{
  "error": {
    "code": "UNAVAILABLE_PRODUCT",
    "message": "Um ou mais produtos nao estao disponiveis",
    "details": [
      { "productId": "uuid", "productName": "Pudim de Leite", "reason": "Produto indisponivel" }
    ]
  }
}
```

---

### PATCH /api/orders/:id/status

Altera o status de um pedido. **Requer perfil `admin`.**

**Request Body:**
```json
{
  "status": "preparing"
}
```

**Response 200:** Objeto do pedido atualizado.

**Response 422:**
```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Nao e possivel alterar o status de 'delivered' para 'pending'"
  }
}
```

---

### PATCH /api/orders/:id/assign

Atribui um entregador a um pedido. **Requer perfil `admin`.**

**Request Body:**
```json
{
  "deliveryPersonId": "uuid-do-entregador"
}
```

**Comportamento:**
- O entregador deve existir e estar ativo (`isActive = true`)
- O entregador nao pode estar atribuido a outro pedido com status `delivering`

**Response 200:** Objeto do pedido atualizado com o entregador.

**Response 422:**
```json
{
  "error": {
    "code": "DELIVERY_PERSON_UNAVAILABLE",
    "message": "Este entregador ja esta atribuido a outro pedido em andamento"
  }
}
```

---

## Entregadores

> Todas as rotas requerem autenticacao.
> Escrita requer perfil `admin`.

### GET /api/delivery-persons

Lista entregadores.

**Query Parameters:**

| Parametro   | Tipo    | Obrigatorio | Descricao                         |
| ----------- | ------- | ----------- | --------------------------------- |
| `isActive`  | boolean | Nao         | Filtro por status ativo           |
| `available` | boolean | Nao         | Se `true`, retorna apenas entregadores sem pedido `delivering` |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Carlos Santos",
      "phone": "(11) 91234-5678",
      "vehicleType": "motorcycle",
      "isActive": true,
      "currentLatitude": -23.5489,
      "currentLongitude": -46.6388,
      "currentOrderId": null
    }
  ]
}
```

---

### POST /api/delivery-persons

Cria um entregador. **Requer perfil `admin`.**

### PUT /api/delivery-persons/:id

Atualiza um entregador. **Requer perfil `admin`.**

### DELETE /api/delivery-persons/:id

Remove um entregador. **Requer perfil `admin`.**
- Nao pode ser removido se estiver atribuido a um pedido com status `delivering`.

---

## Otimizacao

### POST /api/orders/optimize-assignment

Executa o algoritmo de otimizacao de atribuicao. **Requer perfil `admin`.**

**Request Body:** Nenhum (o algoritmo busca automaticamente pedidos `ready` e entregadores disponiveis).

**Response 200:**
```json
{
  "assignments": [
    {
      "orderId": "uuid-pedido-1",
      "deliveryPersonId": "uuid-entregador-3",
      "estimatedDistanceKm": 2.45,
      "orderAddress": "Rua das Flores, 123",
      "deliveryPersonName": "Carlos Santos"
    }
  ],
  "unassigned": [
    {
      "orderId": "uuid-pedido-3",
      "orderAddress": "Av. Paulista, 1000",
      "reason": "No available delivery person"
    }
  ],
  "totalDistanceKm": 4.32,
  "algorithm": "hungarian",
  "executionTimeMs": 12
}
```

**Response 200 (sem pedidos prontos):**
```json
{
  "assignments": [],
  "unassigned": [],
  "totalDistanceKm": 0,
  "algorithm": "hungarian",
  "executionTimeMs": 1
}
```

---

## Relatorios

> Todas as rotas requerem autenticacao (admin ou viewer).

### GET /api/reports/revenue

**Query Parameters:**

| Parametro  | Tipo   | Obrigatorio | Descricao                          |
| ---------- | ------ | ----------- | ---------------------------------- |
| `startDate`| string | Sim         | Data inicio no formato `YYYY-MM-DD`|
| `endDate`  | string | Sim         | Data fim no formato `YYYY-MM-DD`   |

**Response 200:**
```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "totalRevenue": 15420.50,
  "totalOrders": 312,
  "averageOrderValue": 49.42,
  "dailyRevenue": [
    { "date": "2025-01-01", "revenue": 520.00, "orders": 12 },
    { "date": "2025-01-02", "revenue": 480.30, "orders": 10 }
  ]
}
```

---

### GET /api/reports/orders-by-status

**Response 200:**
```json
{
  "data": [
    { "status": "pending", "count": 15 },
    { "status": "preparing", "count": 8 },
    { "status": "ready", "count": 3 },
    { "status": "delivering", "count": 12 },
    { "status": "delivered", "count": 284 },
    { "status": "cancelled", "count": 18 }
  ],
  "total": 340
}
```

---

### GET /api/reports/top-products

**Query Parameters:**

| Parametro  | Tipo    | Obrigatorio | Descricao                          |
| ---------- | ------- | ----------- | ---------------------------------- |
| `startDate`| string  | Nao         | Data inicio (`YYYY-MM-DD`)         |
| `endDate`  | string  | Nao         | Data fim (`YYYY-MM-DD`)            |
| `limit`    | integer | Nao         | Quantidade de produtos (default: 10) |

**Response 200:**
```json
{
  "data": [
    {
      "productId": "uuid",
      "productName": "X-Burger Especial",
      "totalQuantity": 156,
      "totalRevenue": 5134.40
    },
    {
      "productId": "uuid",
      "productName": "Suco de Laranja",
      "totalQuantity": 98,
      "totalRevenue": 1225.00
    }
  ]
}
```

---

### GET /api/reports/average-delivery-time

**Query Parameters:**

| Parametro  | Tipo   | Obrigatorio | Descricao                          |
| ---------- | ------ | ----------- | ---------------------------------- |
| `startDate`| string | Nao         | Data inicio (`YYYY-MM-DD`)         |
| `endDate`  | string | Nao         | Data fim (`YYYY-MM-DD`)            |

**Response 200:**
```json
{
  "averageMinutes": 42.5,
  "fastestMinutes": 18,
  "slowestMinutes": 87,
  "totalDelivered": 284,
  "byVehicleType": [
    { "vehicleType": "motorcycle", "averageMinutes": 35.2, "count": 180 },
    { "vehicleType": "bicycle", "averageMinutes": 52.8, "count": 64 },
    { "vehicleType": "car", "averageMinutes": 38.1, "count": 40 }
  ]
}
```

---

## Formato Padrao de Erro

Todas as respostas de erro seguem este formato:

```json
{
  "error": {
    "code": "CODIGO_DO_ERRO",
    "message": "Mensagem descritiva do erro",
    "details": []
  }
}
```

### Codigos de erro utilizados

| Codigo HTTP | Codigo de Erro                 | Quando usar                                    |
| ----------- | ------------------------------ | ---------------------------------------------- |
| 400         | `VALIDATION_ERROR`             | Dados de entrada invalidos                     |
| 401         | `INVALID_CREDENTIALS`          | Email ou senha incorretos                      |
| 401         | `TOKEN_EXPIRED`                | Access token expirado                          |
| 401         | `INVALID_TOKEN`                | Token mal formado ou invalido                  |
| 401         | `INVALID_REFRESH_TOKEN`        | Refresh token invalido ou expirado             |
| 403         | `FORBIDDEN`                    | Permissao insuficiente para a acao             |
| 404         | `PRODUCT_NOT_FOUND`            | Produto nao encontrado                         |
| 404         | `ORDER_NOT_FOUND`              | Pedido nao encontrado                          |
| 404         | `DELIVERY_PERSON_NOT_FOUND`    | Entregador nao encontrado                      |
| 409         | `PRODUCT_IN_USE`               | Produto vinculado a pedidos ativos             |
| 422         | `INVALID_STATUS_TRANSITION`    | Transicao de status nao permitida              |
| 422         | `UNAVAILABLE_PRODUCT`          | Produto indisponivel para pedido               |
| 422         | `DELIVERY_PERSON_UNAVAILABLE`  | Entregador ja atribuido a outro pedido         |
| 429         | `RATE_LIMIT_EXCEEDED`          | Limite de requisicoes atingido                 |
| 500         | `INTERNAL_ERROR`               | Erro interno do servidor                       |
