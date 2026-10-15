# Esquema do Banco de Dados — FastMeals

Este documento descreve o esquema de referencia do banco de dados PostgreSQL.
Voce pode adicionar campos ou tabelas extras, desde que justifique no `DECISIONS.md`.

---

## Diagrama de Relacionamentos (ER)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    users     │       │    products      │       │ delivery_persons │
├──────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)      │       │ id (PK)          │       │ id (PK)          │
│ email        │       │ name             │       │ name             │
│ password     │       │ description      │       │ phone            │
│ role         │       │ price            │       │ vehicle_type     │
│ created_at   │       │ category         │       │ is_active        │
│ updated_at   │       │ image_url        │       │ current_lat      │
└──────────────┘       │ is_available     │       │ current_lng      │
                       │ preparation_time │       │ created_at       │
                       │ created_at       │       └────────┬─────────┘
                       │ updated_at       │                │
                       └────────┬─────────┘                │
                                │                          │
                                │ 1                        │ 0..1
                                │                          │
                                │ N                        │
                       ┌────────┴─────────┐       ┌────────┴─────────┐
                       │   order_items    │       │     orders       │
                       ├──────────────────┤       ├──────────────────┤
                       │ id (PK)          │  N    │ id (PK)          │
                       │ order_id (FK)    │◄──────│ customer_name    │
                       │ product_id (FK)  │   1   │ customer_phone   │
                       │ quantity         │       │ delivery_address │
                       │ unit_price       │       │ latitude         │
                       │ created_at       │       │ longitude        │
                       └──────────────────┘       │ status           │
                                                  │ total_amount     │
                                                  │ delivery_person_id (FK) │
                                                  │ created_at       │
                                                  │ updated_at       │
                                                  └──────────────────┘
```

---

## Tabelas

### users

Armazena os usuarios do painel administrativo.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indice para busca por email no login
CREATE INDEX idx_users_email ON users(email);
```

---

### products

Armazena os produtos do cardapio.

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
    category VARCHAR(20) NOT NULL CHECK (category IN ('meal', 'drink', 'dessert', 'side')),
    image_url VARCHAR(500),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    preparation_time INTEGER NOT NULL CHECK (preparation_time BETWEEN 1 AND 120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para listagem com filtros
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_available ON products(is_available);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
```

---

### orders

Armazena os pedidos dos clientes.

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    delivery_address VARCHAR(300) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled')),
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount > 0),
    delivery_person_id UUID REFERENCES delivery_persons(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para listagem e filtros
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_delivery_person_id ON orders(delivery_person_id);

-- Indice composto para relatorios por periodo + status
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
```

---

### order_items

Armazena os itens de cada pedido. O `unit_price` e um snapshot do preco no momento da criacao do pedido.

```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indice para busca por pedido
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Indice para relatorios de produtos mais vendidos
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

---

### delivery_persons

Armazena os entregadores.

```sql
CREATE TABLE delivery_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('bicycle', 'motorcycle', 'car')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_delivery_persons_is_active ON delivery_persons(is_active);
```

---

## Observacoes Importantes

### Sobre o campo `unit_price` em `order_items`

O `unit_price` registra o preco do produto **no momento da criacao do pedido**. Isso e necessario porque o preco do produto pode mudar no futuro, e o valor do pedido deve refletir o preco vigente na hora da compra.

**Exemplo:** Se o "X-Burger" custava R$ 32,90 quando o pedido foi feito, mas depois foi atualizado para R$ 35,00, o pedido original deve manter o valor de R$ 32,90.

### Sobre coordenadas geograficas

- `latitude`: varia de -90 a +90 (DECIMAL(10,8) comporta com 8 casas decimais)
- `longitude`: varia de -180 a +180 (DECIMAL(11,8) comporta com 8 casas decimais)
- Para o seed de dados, use coordenadas da regiao de Sao Paulo como referencia

### Sobre o campo `updated_at`

Recomenda-se criar um trigger ou utilizar o mecanismo do ORM escolhido para atualizar automaticamente o campo `updated_at` a cada UPDATE.

### Sobre soft delete

Soft delete **nao e obrigatorio** neste desafio. Se voce optar por implementar, adicione um campo `deleted_at` e ajuste as queries de listagem para filtrar registros deletados. Documente a decisao no `DECISIONS.md`.
