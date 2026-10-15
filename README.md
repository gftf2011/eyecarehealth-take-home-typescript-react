# Desafio Técnico — Engenheiro de Software Sênior

## Sistema de Gerenciamento de Pedidos com Dashboard Analítico

---

## Visão Geral

Você deve construir um **sistema fullstack de gerenciamento de pedidos** para uma empresa fictícia chamada **"FastMeals"**, uma plataforma de delivery de refeições. O sistema é composto por uma **API REST (backend)** e um **dashboard administrativo (frontend)**.

O objetivo é avaliar suas habilidades em **ReactJS, Node.js, TypeScript, modelagem de banco de dados, design de API e algoritmos**.

---

## Contexto de Negócio

A FastMeals precisa de um painel administrativo para que gestores possam:

1. Visualizar e gerenciar pedidos em tempo real
2. Gerenciar o cardápio de produtos (CRUD completo)
3. Visualizar métricas e relatórios analíticos
4. Otimizar a distribuição de pedidos entre entregadores disponíveis

---

## Arquitetura Esperada

```
react-home-made/
├── README.md                  # Este arquivo
├── docs/                      # Documentação de apoio
│   ├── api-spec.md            # Especificação detalhada da API
│   ├── database-schema.md     # Esquema do banco de dados
│   └── evaluation-criteria.md # Critérios de avaliação
├── backend/                   # API Node.js + TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middlewares/
│   │   ├── utils/
│   │   └── algorithms/
│   ├── prisma/                # ou outro ORM de sua escolha
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── tests/
├── frontend/                  # React + TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   ├── context/
│   │   └── utils/
│   └── tests/
└── seed/                      # Dados de exemplo para popular o banco
    └── data.json
```

> **Nota:** A estrutura acima é uma **sugestão**. Você tem liberdade para organizá-la como preferir, desde que justifique suas decisões arquiteturais em um arquivo `DECISIONS.md` na raiz do projeto.

---

## Stack Obrigatória

| Camada     | Tecnologia                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| Frontend   | **React 18+** com **TypeScript**                                           |
| Backend    | **Node.js** com **TypeScript** (Express, Fastify ou Koa — à sua escolha)   |
| Banco      | **PostgreSQL** ou **MySql** ou **MongoDB** (obrigatório) com ORM/Query Builder à sua escolha se aplicável           |
| Testes     | Framework de sua escolha (Jest, Vitest, etc.)                              |

Bibliotecas adicionais são permitidas, mas cada uma deve ser justificada no `DECISIONS.md`.

---

## Requisitos Funcionais

### 1. Autenticação e Autorização

O sistema deve ter dois perfis de acesso:

| Perfil     | Permissões                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| **admin**  | Acesso total: CRUD de produtos, pedidos, entregadores, relatórios          |
| **viewer** | Somente leitura: visualizar pedidos, produtos e relatórios                 |

**Regras:**
- Implementar autenticação via **JWT** (access token + refresh token)
- O access token deve expirar em **15 minutos**
- O refresh token deve expirar em **7 dias**
- Senhas devem ser armazenadas com **bcrypt** (mínimo 10 salt rounds)
- Rotas protegidas devem retornar `401` para tokens inválidos/expirados e `403` para permissão insuficiente
- Implementar middleware de rate limiting: **máximo 100 requisições por minuto por IP**

**Dados para seed (usuários pré-cadastrados):**

| Email                  | Senha      | Perfil  |
| ---------------------- | ---------- | ------- |
| admin@fastmeals.com    | Admin@123  | admin   |
| viewer@fastmeals.com   | Viewer@123 | viewer  |

---

### 2. Gerenciamento de Produtos (CRUD)

Cada produto possui os seguintes campos:

| Campo            | Tipo      | Regras                                                     |
| ---------------- | --------- | ---------------------------------------------------------- |
| `id`             | UUID      | Gerado automaticamente                                     |
| `name`           | string    | Obrigatório, entre 3 e 120 caracteres                      |
| `description`    | string    | Obrigatório, entre 10 e 500 caracteres                     |
| `price`          | decimal   | Obrigatório, maior que 0, máximo 2 casas decimais          |
| `category`       | enum      | `meal`, `drink`, `dessert`, `side`                         |
| `imageUrl`       | string    | Opcional, deve ser URL válida se preenchido                 |
| `isAvailable`    | boolean   | Default: `true`                                            |
| `preparationTime`| integer   | Obrigatório, em minutos, entre 1 e 120                     |
| `createdAt`      | timestamp | Gerado automaticamente                                     |
| `updatedAt`      | timestamp | Atualizado automaticamente                                 |

**Regras de negócio:**
- Não é possível deletar um produto que está vinculado a pedidos com status `pending` ou `preparing`
- Ao desativar um produto (`isAvailable = false`), ele não deve aparecer nas listagens públicas, mas deve continuar visível no painel admin
- A listagem deve suportar **paginação**, **busca por nome** e **filtro por categoria e disponibilidade**

---

### 3. Gerenciamento de Pedidos

Cada pedido possui os seguintes campos:

| Campo            | Tipo       | Descrição                                                 |
| ---------------- | ---------- | --------------------------------------------------------- |
| `id`             | UUID       | Gerado automaticamente                                    |
| `customerName`   | string     | Nome do cliente, entre 3 e 100 caracteres                 |
| `customerPhone`  | string     | Telefone no formato brasileiro: `(XX) XXXXX-XXXX`         |
| `deliveryAddress`| string     | Endereço completo, entre 10 e 300 caracteres              |
| `latitude`       | decimal    | Latitude do endereço de entrega                           |
| `longitude`      | decimal    | Longitude do endereço de entrega                          |
| `items`          | array      | Lista de itens (produto + quantidade)                     |
| `status`         | enum       | Ver diagrama de estados abaixo                            |
| `totalAmount`    | decimal    | Calculado automaticamente pelo backend                    |
| `deliveryPersonId`| UUID      | Entregador atribuído (pode ser null)                      |
| `createdAt`      | timestamp  | Gerado automaticamente                                    |
| `updatedAt`      | timestamp  | Atualizado automaticamente                                |

**Diagrama de estados do pedido:**

```
  ┌─────────┐     ┌───────────┐     ┌────────────┐     ┌───────────┐     ┌───────────┐
  │ pending  │────>│ preparing │────>│   ready    │────>│ delivering│────>│ delivered │
  └─────────┘     └───────────┘     └────────────┘     └───────────┘     └───────────┘
       │               │                  │
       │               │                  │
       v               v                  v
  ┌───────────┐   ┌───────────┐     ┌───────────┐
  │ cancelled │   │ cancelled │     │ cancelled │
  └───────────┘   └───────────┘     └───────────┘
```

**Transições válidas (IMPORTANTE — rejeitar qualquer transição não listada):**

| De            | Para           | Condição                                                |
| ------------- | -------------- | ------------------------------------------------------- |
| `pending`     | `preparing`    | Nenhuma condição adicional                              |
| `pending`     | `cancelled`    | Nenhuma condição adicional                              |
| `preparing`   | `ready`        | Nenhuma condição adicional                              |
| `preparing`   | `cancelled`    | Nenhuma condição adicional                              |
| `ready`       | `delivering`   | Obrigatório ter um `deliveryPersonId` atribuído         |
| `ready`       | `cancelled`    | Nenhuma condição adicional                              |
| `delivering`  | `delivered`    | Nenhuma condição adicional                              |

**Qualquer outra transição** (ex: `delivered` → `pending`, `delivering` → `cancelled`) deve retornar **erro 422** com mensagem descritiva.

**Regras de negócio adicionais:**
- O `totalAmount` é sempre calculado pelo backend: soma de `(produto.price * item.quantity)` para cada item
- Não é possível criar um pedido com produtos que tenham `isAvailable = false`
- A listagem deve suportar **paginação**, **filtro por status** e **ordenação por data de criação**

---

### 4. Gerenciamento de Entregadores

Cada entregador possui:

| Campo            | Tipo      | Descrição                                                  |
| ---------------- | --------- | ---------------------------------------------------------- |
| `id`             | UUID      | Gerado automaticamente                                     |
| `name`           | string    | Obrigatório, entre 3 e 100 caracteres                      |
| `phone`          | string    | Formato: `(XX) XXXXX-XXXX`                                 |
| `vehicleType`    | enum      | `bicycle`, `motorcycle`, `car`                              |
| `isActive`       | boolean   | Default: `true`                                             |
| `currentLatitude`| decimal   | Localização atual (nullable)                                |
| `currentLongitude`| decimal  | Localização atual (nullable)                                |
| `createdAt`      | timestamp | Gerado automaticamente                                     |

---

### 5. Dashboard Analítico (Frontend)

O dashboard deve conter as seguintes telas:

#### 5.1 Tela de Login
- Formulário com email e senha
- Validação de campos no frontend
- Feedback visual de erros (credenciais inválidas, campos obrigatórios)
- Redirecionamento automático para o dashboard após login bem-sucedido
- Se o token expirar, redirecionar para a tela de login

#### 5.2 Painel de Pedidos
- **Lista de pedidos** com paginação e filtros (status, data)
- **Cards ou linhas** com: nome do cliente, itens resumidos, valor total, status, data
- **Ação de mudar status** (botões contextuais de acordo com as transições válidas)
- **Detalhes do pedido** em modal ou página separada
- **Indicador visual** diferente para cada status (cores ou ícones)

#### 5.3 Gerenciamento de Produtos
- Tabela com listagem paginada e busca
- Formulário de criação/edição com **validação em tempo real**
- Confirmação antes de deletar (modal de confirmação)
- Toggle de disponibilidade direto na listagem

#### 5.4 Relatórios e Métricas
Esta tela deve exibir **quatro métricas** calculadas pelo backend:

| Métrica                           | Descrição                                                              |
| --------------------------------- | ---------------------------------------------------------------------- |
| **Receita por período**           | Soma do `totalAmount` dos pedidos `delivered` em um intervalo de datas  |
| **Pedidos por status**            | Contagem de pedidos agrupados por status                               |
| **Produtos mais vendidos**        | Top 10 produtos por quantidade vendida (considerar apenas `delivered`)  |
| **Tempo médio de entrega**        | Média de tempo entre `createdAt` e a transição para `delivered`         |

- Os relatórios devem aceitar **filtro de período** (data início e data fim)
- Pelo menos **dois gráficos** devem ser renderizados (bar chart, pie chart, line chart — sua escolha)

#### 5.5 Tela de Atribuição de Entregadores (Algoritmo)
- Exibir pedidos com status `ready` (aguardando entregador)
- Exibir lista de entregadores ativos e disponíveis
- Botão **"Sugerir Atribuição Otimizada"** que aciona o algoritmo descrito na seção 6
- Exibir o resultado da sugestão com possibilidade de **aceitar ou rejeitar** cada atribuição
- Após aceitar, o pedido deve transitar para `delivering`

---

### 6. Desafio de Algoritmo — Otimização de Atribuição de Entregadores

Este é o diferencial do desafio. Você deve implementar um algoritmo no **backend** que, dado:

**Entrada:**
- Uma lista de pedidos com status `ready`, cada um com coordenadas `(latitude, longitude)`
- Uma lista de entregadores ativos e sem pedido em andamento, cada um com coordenadas `(currentLatitude, currentLongitude)`

**Saída:**
- Uma lista de atribuições `{ orderId, deliveryPersonId, estimatedDistance }` que minimize a **distância total percorrida**

**Requisitos do algoritmo:**
1. Cada entregador pode receber **no máximo 1 pedido** por vez
2. A distância entre dois pontos deve ser calculada usando a **fórmula de Haversine** (distância geodésica)
3. O algoritmo deve buscar minimizar a **soma total das distâncias** de todos os entregadores aos seus respectivos pedidos
4. Se houver mais pedidos do que entregadores, os pedidos excedentes devem ser retornados como `unassigned`
5. Se houver mais entregadores do que pedidos, os entregadores excedentes ficam sem atribuição
6. O algoritmo deve ter complexidade **razoável** (não será aceito brute-force O(n!) para mais de 6 elementos)

**Endpoint esperado:**

```
POST /api/orders/optimize-assignment
```

**Exemplo de resposta:**
```json
{
  "assignments": [
    {
      "orderId": "uuid-pedido-1",
      "deliveryPersonId": "uuid-entregador-3",
      "estimatedDistanceKm": 2.45
    },
    {
      "orderId": "uuid-pedido-2",
      "deliveryPersonId": "uuid-entregador-1",
      "estimatedDistanceKm": 1.87
    }
  ],
  "unassigned": [
    {
      "orderId": "uuid-pedido-3",
      "reason": "No available delivery person"
    }
  ],
  "totalDistanceKm": 4.32
}
```

> **Dica:** pesquise sobre o **Problema de Atribuição (Hungarian Algorithm)** ou abordagens **greedy** com heurísticas. Documente a abordagem escolhida e sua complexidade no `DECISIONS.md`.

---

## Requisitos Não Funcionais

### Qualidade de Código
- Todo o código deve ser escrito em **TypeScript** com tipagem estrita (`strict: true` no `tsconfig.json`)
- **Sem uso de `any`** — utilize tipos genéricos, union types, interfaces ou `unknown` quando necessário
- Seguir princípios **SOLID** onde aplicável
- Código limpo e legível — nomes descritivos de variáveis, funções e arquivos

### Validação e Tratamento de Erros
- Toda entrada de dados (body, query params, path params) deve ser **validada** no backend (use Zod, Joi ou similar)
- Erros devem seguir um formato padronizado:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrição legível do erro",
    "details": [
      {
        "field": "price",
        "message": "O preço deve ser maior que zero"
      }
    ]
  }
}
```

- Códigos HTTP devem ser semânticos: `200`, `201`, `400`, `401`, `403`, `404`, `422`, `429`, `500`

### Testes (obrigatório)
- **Backend:** Mínimo de **10 testes** cobrindo:
  - Pelo menos 2 testes de autenticação (token válido, token inválido)
  - Pelo menos 2 testes de CRUD de produtos (criação válida, validação de campos)
  - Pelo menos 2 testes de transição de status de pedido (transição válida, transição inválida)
  - Pelo menos 2 testes do algoritmo de otimização (caso com solução, caso sem entregadores disponíveis)
  - Pelo menos 2 testes de relatórios (receita por período, produtos mais vendidos)
- **Frontend:** Mínimo de **5 testes** cobrindo:
  - Pelo menos 1 teste de renderização de componente
  - Pelo menos 1 teste de interação de usuário (clique, input)
  - Pelo menos 1 teste de integração de tela (ex: fluxo de login)

### Performance
- Listagens paginadas devem responder em **menos de 200ms** com até 10.000 registros no banco
- O endpoint de otimização deve responder em **menos de 2 segundos** com até 50 pedidos e 30 entregadores

---

## Dados de Seed

O arquivo `seed/data.json` fornecido contém dados para popular o banco. Você deve criar um script que:

1. Leia o arquivo `seed/data.json`
2. Popule o banco de dados com os dados fornecidos
3. Possa ser executado via `npm run seed` (no diretório `backend/`)

---

## Entrega

### O que deve ser entregue

1. **Código fonte** completo (backend + frontend)
2. **`DECISIONS.md`** na raiz do projeto, contendo:
   - Justificativa das bibliotecas escolhidas
   - Explicação da abordagem do algoritmo de otimização (complexidade, trade-offs)
   - Decisões arquiteturais relevantes
   - Dificuldades encontradas e como foram resolvidas
3. **`docker-compose.yml`** para subir o ambiente completo (backend + frontend + banco) com um único comando
4. **Instruções claras** de como rodar o projeto no README do backend e do frontend

### Como rodar (esperado)

```bash
# Subir tudo com Docker
docker-compose up --build

# OU, sem Docker:

# Terminal 1 — Banco de dados
# (configurar PostgreSQL local)

# Terminal 2 — Backend
cd backend
npm install
npm run seed
npm run dev    # deve rodar na porta 3001

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev    # deve rodar na porta 3000
```

### Prazo

**7 dias corridos** a partir do recebimento deste desafio.

---

## Perguntas Frequentes

**P: Posso usar um ORM?**
R: Sim. Prisma, TypeORM, Drizzle, Knex — à sua escolha. Justifique no `DECISIONS.md`.

**P: Posso usar bibliotecas de componentes no frontend (MUI, Chakra, etc.)?**
R: Sim, mas demonstre que sabe customizar e não apenas usar componentes padrão.

**P: Preciso implementar upload de imagens para produtos?**
R: Não. O campo `imageUrl` aceita uma URL externa. Não é necessário implementar upload de arquivos.

**P: Posso usar WebSockets para atualizações em tempo real?**
R: É um diferencial, mas não é obrigatório. Polling com intervalo de 30 segundos é aceitável.

**P: Posso alterar a estrutura do banco de dados?**
R: Sim. O esquema no `docs/database-schema.md` é uma referência. Você pode adicionar campos ou tabelas, desde que justifique.

**P: O algoritmo precisa ser 100% ótimo?**
R: Não. Uma solução heurística boa é aceitável, desde que você documente a abordagem, a complexidade e os trade-offs. O que importa é demonstrar raciocínio algorítmico sólido.

---

## Resumo de Avaliação

| Critério                       | Peso   |
| ------------------------------ | ------ |
| Qualidade e organização do código | 20%  |
| Modelagem de banco de dados       | 15%  |
| Design e implementação da API     | 15%  |
| Funcionalidade do frontend        | 15%  |
| Algoritmo de otimização           | 15%  |
| Testes                            | 10%  |
| Documentação (DECISIONS.md)       | 10%  |

Consulte `docs/evaluation-criteria.md` para detalhes de cada critério.

---

Boa sorte! Se tiver dúvidas sobre os requisitos, entre em contato antes de assumir premissas.
