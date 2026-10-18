# FastMeals — Backend

API REST, worker de outbox e gateway WebSocket do painel administrativo da **FastMeals**, uma plataforma de delivery de refeições. Gerencia cardápio, pedidos (máquina de estados), entregadores, relatórios analíticos e a **atribuição otimizada de entregadores** (algoritmo Húngaro + distância de Haversine), com atualização do painel em tempo real.

- **Node.js 22+**, **TypeScript** estrito (sem `any`), **Fastify 5**, **PostgreSQL 17** com **Kysely**, **Redis 7**, **AWS SNS + SQS** (emulados localmente pelo [Floci](https://floci.io)), **Zod**, **Vitest** + **Testcontainers**
- Clean Architecture + DDD: um módulo por bounded context, domínio sem dependências de framework
- Testes unitários, de integração (PostgreSQL/Redis/Floci reais), e2e (HTTP/WebSocket), de performance e de arquitetura (ArchUnitTS)

## Início rápido

O [`docker-compose.yml`](../docker-compose.yml) é único e fica na **raiz do repositório**. Lá, um comando sobe o projeto inteiro (PostgreSQL, Redis, Floci com SNS/SQS, migrations, topologia de mensageria, seed, API, outbox relay, gateway WebSocket e o painel em http://localhost:3000):

```bash
docker compose up --build
```

Para subir **só o backend** (por exemplo, para desenvolver o painel com o Vite), dentro de `backend/`, o script usa o mesmo compose e só termina quando tudo estiver saudável:

```bash
cd backend && npm run docker:up
```

Pronto: API em http://localhost:3001/api, WebSocket em ws://localhost:3002/realtime, login `admin@fastmeals.com` / `Admin@123`. Para parar: `npm run docker:down`.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Como rodar](#como-rodar)
- [Como testar](#como-testar)
- [Recursos da API](#recursos-da-api)
- [Autenticação e autorização](#autenticação-e-autorização)
- [Erros](#erros)
- [Tempo real (WebSocket)](#tempo-real-websocket)
- [Mensageria (SNS + SQS)](#mensageria-sns--sqs)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Estrutura de pastas](#estrutura-de-pastas)

---

## Arquitetura

### Três processos, um código

O mesmo código (e a mesma imagem Docker) roda em três processos independentes:

```
                         ┌─────────────────────────── PostgreSQL ───────────────────────────┐
                         │  tabelas dos contextos            outbox_events                   │
                         └───────▲──────────────────────────────────▲────────────┬──────────┘
                                 │ casos de uso (transação)          │ mesma tx    │ FOR UPDATE
                                 │                                   │             │ SKIP LOCKED
 painel ──HTTP──>  API :3001  ───┴── handler grava a mensagem ───────┘             │
                   (server.ts)                                                     │
                                                         outbox-relay (worker) ◄───┘
                                                         (outbox-relay.ts)
                                                                  │ Publish
                                                                  ▼
                                                    SNS fastmeals-events (atributo `topic`)
                                                                  │ assinatura (filtro por tópico, entrega crua)
                                                                  ▼
                                   SQS fastmeals-realtime ──5 recebimentos sem sucesso──► SQS fastmeals-realtime-dlq
                                                                  │ long polling (uma réplica recebe)
                                                                  ▼
 painel <──WebSocket──  realtime :3002  ──PUBLISH/SUBSCRIBE──  Redis pub/sub (todas as réplicas recebem)
                        (realtime-gateway.ts)
```

| Processo | Entrypoint | Responsabilidade | Depende de |
|---|---|---|---|
| **API** | `src/main/server.ts` | REST, autenticação, regras de negócio; grava eventos de integração no outbox | PostgreSQL, Redis (rate limit), segredos JWT |
| **Outbox relay** | `src/main/outbox-relay.ts` | Publica as mensagens confirmadas do outbox no tópico SNS; retentativa com backoff; fila morta do outbox; limpeza após 7 dias | PostgreSQL, SNS |
| **Realtime gateway** | `src/main/realtime-gateway.ts` | Consome a fila SQS do tempo real, espalha cada evento pelo Redis entre as réplicas e o repassa aos painéis por WebSocket autenticado | SQS, Redis, segredo do access token |

Dois jobs de uma execução preparam o ambiente: `migrate` (migrations) e `messaging-setup` (tópico, filas, fila morta e assinatura; ver [Mensageria](#mensageria-sns--sqs)).

Por que separados: conexões longas (WebSocket) e o worker não competem com a API, cada um escala e reinicia sozinho, e um deploy da API não derruba os painéis. O relay pode ter várias réplicas (lotes disjuntos via `SKIP LOCKED`); o gateway também (a fila divide as mensagens entre as réplicas, e o Redis as leva a todas).

### Bounded contexts

| Contexto | Responsabilidade |
|---|---|
| `identity` | Usuários, login, sessões de refresh com rotação e detecção de reuso, JWT |
| `catalog` | Produtos do cardápio (CRUD, disponibilidade, soft delete) |
| `ordering` | Pedidos: criação com snapshot de preço, máquina de estados, atribuição e despacho |
| `delivery` | Entregadores e o **otimizador de atribuição** (Húngaro + Haversine) |
| `reporting` | Relatórios agregados (receita, status, mais vendidos, tempo de entrega) — só leitura |
| `realtime` | Sessões WebSocket e o protocolo do painel em tempo real |
| `shared-kernel` | Base comum: agregados, eventos, unit of work, mediator, outbox, HTTP, paginação, datas |

Cada contexto segue as camadas `domain` → `application` → `infra` → `presentation`, montadas em `main/` (composition root). Contextos não importam o domínio uns dos outros: fatos externos entram por **camadas anticorrupção (ACL)** — por exemplo, o Ordering consulta preço e disponibilidade do produto pela `ProductCatalog`, e o Catalog pergunta ao Ordering se um produto está em pedidos abertos pela `ActiveOrdersChecker`.

### Decisões que afetam o uso

- **Valores monetários** são calculados em centavos inteiros e expostos em reais (`65.8`).
- **Datas de filtro** (`startDate`/`endDate`, `YYYY-MM-DD`) são **dias locais de São Paulo**, com as duas pontas inclusivas.
- **Produtos e entregadores** usam soft delete: somem das listagens, mas pedidos antigos continuam exibindo-os.
- **Concorrência**: pedidos e entregadores são travados (`FOR UPDATE`) antes de qualquer alteração; um índice único parcial garante no banco que um entregador nunca tenha duas entregas em andamento.
- **Eventos de domínio** passam por um mediator em memória; só o que precisa sair do processo vira mensagem no outbox (na mesma transação do caso de uso).

---

## Como rodar

### Opção 1 — Docker (recomendado)

O [`docker-compose.yml`](../docker-compose.yml) da raiz descreve todos os serviços. Os scripts abaixo, dentro de `backend/`, usam esse compose para cuidar só do backend:

```bash
npm run docker:up
```

| Script | O que faz |
|---|---|
| `npm run docker:up` | Constrói a imagem e sobe o backend em segundo plano (API, relay, gateway e as dependências); termina quando todos os serviços estão saudáveis e mostra o estado de cada um |
| `npm run docker:logs` | Acompanha os logs da API, do relay e do gateway |
| `npm run docker:down` | Para e remove os contêineres (os dados do banco ficam no volume) |
| `npm run docker:reset` | Apaga o volume do banco e sobe tudo de novo, com seed limpo |

Os scripts só chamam o Docker Compose (`docker compose -f ../docker-compose.yml …`).

Sobe, nesta ordem: `postgres`, `redis` e `floci` → `migrate` (aplica as migrations e sai) → `messaging-setup` (cria tópico SNS, filas SQS e assinatura, e sai) e `seed` (popula com `seed/data.json` e sai) → `api`, `outbox-relay` e `realtime`. Todos têm health check. A imagem é construída uma vez (pelo `migrate`) com a raiz do repositório como contexto (ela leva o `seed/data.json`), filtrada por [`Dockerfile.dockerignore`](Dockerfile.dockerignore), que só deixa entrar `backend/` e `seed/`; os outros serviços reaproveitam a mesma imagem.

| Serviço | URL |
|---|---|
| API | http://localhost:3001/api |
| Health da API | http://localhost:3001/api/health |
| WebSocket | ws://localhost:3002/realtime |
| Health do gateway | http://localhost:3002/health |
| PostgreSQL | `localhost:5432` (usuário `fastmeals` / senha `fastmeals123`) |
| Redis | `localhost:6379` |
| Floci (SNS/SQS) | http://localhost:4566 (credenciais `test` / `test`) |

O seed é idempotente: num segundo `up`, ele só avisa que o banco já tem dados. Para recriar tudo do zero, use `npm run docker:reset`.

> Os padrões do `docker-compose.yml` são de **desenvolvimento local** (segredos de exemplo, cookie sem `Secure` por ser HTTP). Para outro ambiente, defina as variáveis num `.env` **na raiz**, que o Compose lê automaticamente (ver [`.env.example`](../.env.example)).
>
> No compose, a API confia em um salto de proxy (`TRUST_PROXY=1`): o nginx do painel, que acrescenta o IP real ao `X-Forwarded-For`, então o rate limit por IP enxerga o cliente real. As portas do backend (API, gateway, Postgres, Redis, Floci) só abrem em `127.0.0.1`: ninguém na rede chama a API direto forjando o cabeçalho. Nada depende de sub-rede ou IP fixo.

### Opção 2 — Local, sem Docker para a aplicação

Pré-requisitos: **Node.js 22+**, **PostgreSQL**, **Redis** e o **Floci** rodando (por exemplo, via Docker, na raiz: `docker compose up -d postgres redis floci`).

```bash
cd backend
cp ../.env.example .env        # ajuste DATABASE_URL, REDIS_URL e os segredos JWT
npm install
npm run seed                   # aplica as migrations e popula o banco
npm run dev                    # API em http://localhost:3001
```

Para o painel em tempo real, crie a topologia de mensageria uma vez e suba o relay e o gateway em outros terminais:

```bash
npm run messaging:setup        # tópico SNS, fila SQS, fila morta e assinatura no Floci
```

```bash
npm run dev:relay              # worker do outbox
```

```bash
npm run dev:realtime           # WebSocket em ws://localhost:3002/realtime
```

`npm run seed -- --reset` apaga os dados e popula de novo (recusado com `NODE_ENV=production`).

### Usuários do seed

| Email | Senha | Perfil |
|---|---|---|
| `admin@fastmeals.com` | `Admin@123` | admin (acesso total) |
| `viewer@fastmeals.com` | `Viewer@123` | viewer (somente leitura) |

O seed também cria 15 produtos, 6 entregadores e 12 pedidos em todos os status, passando pelos mesmos casos de uso da API. Os horários são realistas: pedidos finalizados espalhados pelas últimas duas semanas e pedidos em andamento nas últimas horas, para os relatórios terem dados.

### Teste rápido com curl

```bash
TOKEN=$(curl -s -X POST localhost:3001/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@fastmeals.com","password":"Admin@123"}' | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
```

```bash
curl -s "localhost:3001/api/orders?status=ready" -H "authorization: Bearer $TOKEN"
```

```bash
curl -s -X POST localhost:3001/api/orders/optimize-assignment -H "authorization: Bearer $TOKEN"
```

```bash
curl -s "localhost:3001/api/reports/revenue?startDate=2025-01-01&endDate=2025-12-31" -H "authorization: Bearer $TOKEN"
```

---

## Como testar

```bash
npm test                   # todas as suítes
npm run test:unit          # só unitários (rápidos, sem Docker)
npm run test:architecture  # regras de arquitetura (ArchUnitTS), sem Docker
npm run test:integration   # adapters contra PostgreSQL, Redis e Floci reais
npm run test:e2e           # API HTTP e WebSocket de ponta a ponta
npm run typecheck          # tsc --noEmit (strict)
```

> **Integração e e2e exigem Docker em execução.** O Vitest sobe PostgreSQL 17, Redis 7 e Floci (SNS/SQS) descartáveis com Testcontainers (uma vez por execução), aplica as migrations reais e destrói tudo ao final. Nada é configurado à mão.

### Tipos de teste

O tipo está no nome do arquivo, ao lado do código testado:

| Sufixo | O que cobre | Arquivos |
|---|---|---|
| `*.unit.spec.ts` | Domínio e casos de uso com fakes em memória; sem I/O | 82 |
| `*.integration.spec.ts` | Repositórios, ACLs, consultas, outbox, Redis, SNS/SQS, seed, migrations — contra dependências reais | 19 |
| `*.e2e.spec.ts` | Requisições HTTP reais na API (`app.inject`) e clientes WebSocket reais no gateway | 9 |
| `*.architecture.spec.ts` | Regras de arquitetura sobre o código-fonte, com [ArchUnitTS](https://github.com/LukasNiessen/ArchUnitTS) | 3 |

### Testes de arquitetura

Em [`src/architecture/`](src/architecture), as convenções do projeto viram testes que falham no CI quando alguém as quebra (cada regra também falha se o padrão não selecionar nenhum arquivo, então uma regra nunca passa "por vazio"):

| Arquivo | Regras |
|---|---|
| `layers.architecture.spec.ts` | Dependências só para dentro: `domain` não depende de `application`/`infra`/`presentation`/`main`; `application` não depende de `infra`/`presentation`/`main`; `infra` e `presentation` não dependem uma da outra nem de `main`; nenhuma camada depende de `src/main`; sem dependências circulares |
| `bounded-contexts.architecture.spec.ts` | Nenhum contexto importa código de outro (fatos externos entram por ACL); o shared kernel não depende de nenhum contexto; domínio sem bibliotecas externas; aplicação, controllers e rotas sem banco, cache, HTTP ou criptografia |
| `conventions.architecture.spec.ts` | Imports sem `.js` e sem `/index`; tipo do teste no nome do arquivo; arquivos de produção com até 400 linhas; casos de uso em `usecases/<nome>/<nome>.usecase.ts` implementando `UseCase`; erros, eventos e repositórios do domínio nas pastas e nomes certos; repositórios só para raízes de agregado; `infra/persistence` organizada por papel; controllers e rotas em um arquivo cada |

As regras valem para o código de produção: testes e pastas `testing/` podem atravessar camadas e contextos para montar cenários.

> **Dependências sem vulnerabilidades (`npm audit` zerado).** O ArchUnitTS depende de `plantuml-parser`, que traz `fast-glob` → `micromatch` → `braces`, com uma vulnerabilidade alta ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) que ainda não tem versão corrigida. O ArchUnitTS só usa o `parse(texto)` do `plantuml-parser`; o `fast-glob` só é chamado ao ler diagramas do disco, o que o projeto não faz. Por isso o `package.json` tem um `overrides` limitado ao `plantuml-parser` que troca o `fast-glob` pelo [`tinyglobby`](https://github.com/SuperchupuDev/tinyglobby), que não depende de `braces`. As dependências de produção não são afetadas: o ArchUnitTS é `devDependency` e não entra na imagem Docker.

### Onde estão os testes exigidos pelo desafio

| Exigência | Onde |
|---|---|
| Autenticação (token válido / inválido) | `identity/presentation/auth-api.e2e.spec.ts`, `catalog/presentation/products-api.e2e.spec.ts` |
| CRUD de produtos (criação válida / validação) | `catalog/presentation/products-api.e2e.spec.ts`, `catalog/application/usecases/*/*.unit.spec.ts` |
| Transição de status (válida / inválida) | `ordering/domain/order/order-status-transitions.unit.spec.ts` (as 36 combinações), `ordering/presentation/orders-api.e2e.spec.ts` |
| Algoritmo (com solução / sem entregadores) | `delivery/domain/dispatch/**/*.unit.spec.ts` (comparado com força bruta), `delivery/application/usecases/suggest-assignment/*.unit.spec.ts`, `delivery/presentation/optimize-assignment-api.e2e.spec.ts` |
| Relatórios (receita por período / mais vendidos) | `reporting/application/usecases/**/*.unit.spec.ts`, `reporting/infra/persistence/queries/*.integration.spec.ts`, `reporting/presentation/reports-api.e2e.spec.ts` |

### Performance e concorrência (também automatizados)

- **Listagens < 200 ms com 10.000 registros**, com `EXPLAIN` confirmando o índice usado: `kysely-product.repository.performance.integration.spec.ts`, `kysely-order.repository.performance.integration.spec.ts`, `kysely-report-queries.performance.integration.spec.ts`.
- **Otimização < 2 s com 50 pedidos e 30 entregadores**, em memória e no PostgreSQL: `suggest-assignment.usecase.unit.spec.ts`, `kysely-delivery-unit-of-work.integration.spec.ts`.
- **Concorrência real** (transações em paralelo): sem lost update na mudança de status, nunca duas entregas para o mesmo entregador, remoção de entregador esperando o despacho, relays em paralelo sem duplicar mensagens.

---

## Recursos da API

Todas as rotas têm o prefixo `/api` e respondem JSON. Formato de listagem paginada: `{ "data": [...], "pagination": { "page", "limit", "total", "totalPages" } }`.

**Permissões**: `admin` tem todas; `viewer` tem `products:read`, `orders:read` e `reports:read`.

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/login` | `{ email, password }` → `{ accessToken, accessTokenExpiresAt, user }` + cookie `fastmeals_refresh` |
| `POST` | `/auth/refresh` | Lê o cookie, rotaciona a sessão e devolve um novo access token (e um novo cookie) |
| `POST` | `/auth/logout` | Revoga a sessão e apaga o cookie → `204` |
| `GET` | `/health` | Estado do PostgreSQL e do Redis (`200` ou `503`) |

### Produtos

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| `GET` | `/products` | `products:read` | `page`, `limit` (≤ 100), `search` (parcial, sem diferenciar maiúsculas), `category`, `isAvailable`, `sortBy` (`name`, `price`, `createdAt`), `sortOrder` |
| `GET` | `/products/:id` | `products:read` | Detalhe (`404 PRODUCT_NOT_FOUND`) |
| `POST` | `/products` | `products:write` | Cria → `201` |
| `PUT` | `/products/:id` | `products:write` | Atualização parcial (inclui `isAvailable`) |
| `DELETE` | `/products/:id` | `products:write` | Soft delete → `204`; `409 PRODUCT_IN_USE` se estiver em pedido `pending`/`preparing` |

### Pedidos

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| `GET` | `/orders` | `orders:read` | `page`, `limit`, `status`, `startDate`/`endDate` (dia de criação), `sortBy` (`createdAt`, `totalAmount`), `sortOrder` |
| `GET` | `/orders/:id` | `orders:read` | Detalhe com itens e `deliveryPerson: { id, name } \| null` |
| `POST` | `/orders` | `orders:write` | `{ customerName, customerPhone, deliveryAddress, latitude, longitude, items: [{ productId, quantity }] }` → `201`, total calculado pelo backend |
| `PATCH` | `/orders/:id/status` | `orders:write` | `{ status }`; transição inválida → `422 INVALID_STATUS_TRANSITION` |
| `PATCH` | `/orders/:id/assign` | `orders:write` | `{ deliveryPersonId }`; entregador inativo/ocupado → `422 DELIVERY_PERSON_UNAVAILABLE` |
| `POST` | `/orders/:id/dispatch` | `orders:write` | `{ deliveryPersonId }`: atribui e passa para `delivering` numa transação (o "aceitar" da sugestão) |
| `POST` | `/orders/optimize-assignment` | `orders:write` | Sugere a atribuição pedido → entregador de menor distância total (não altera nada) |

Transições válidas: `pending → preparing | cancelled`, `preparing → ready | cancelled`, `ready → delivering | cancelled` (exige entregador ativo e livre), `delivering → delivered`. Qualquer outra é recusada.

Resposta da otimização:

```json
{
  "assignments": [
    { "orderId": "…", "deliveryPersonId": "…", "estimatedDistanceKm": 2.45,
      "orderAddress": "Rua das Flores, 123", "deliveryPersonName": "Carlos Santos" }
  ],
  "unassigned": [{ "orderId": "…", "orderAddress": "Av. Paulista, 1000", "reason": "No available delivery person" }],
  "unlocatedDeliveryPersons": [{ "id": "…", "name": "Sem GPS" }],
  "totalDistanceKm": 2.45,
  "algorithm": "hungarian",
  "executionTimeMs": 0.42
}
```

### Entregadores

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| `GET` | `/delivery-persons` | `delivery-persons:read` | `isActive`, `available` (sem pedido `delivering`); cada item traz `currentOrderId` |
| `POST` | `/delivery-persons` | `delivery-persons:write` | `{ name, phone, vehicleType, isActive?, currentLatitude?, currentLongitude? }` → `201` |
| `PUT` | `/delivery-persons/:id` | `delivery-persons:write` | Atualização parcial (dados, ativação, localização; as duas coordenadas `null` apagam a posição) |
| `DELETE` | `/delivery-persons/:id` | `delivery-persons:write` | Soft delete → `204`; `409 DELIVERY_PERSON_IN_USE` se estiver em entrega |

### Relatórios

| Método | Rota | Parâmetros | Base de data |
|---|---|---|---|
| `GET` | `/reports/revenue` | `startDate`, `endDate` **obrigatórios** (até 366 dias) | Entrega |
| `GET` | `/reports/orders-by-status` | período opcional | Criação |
| `GET` | `/reports/top-products` | período opcional, `limit` (padrão 10, de 1 a 100) | Entrega |
| `GET` | `/reports/average-delivery-time` | período opcional | Entrega |

Todos exigem `reports:read`. Receita, mais vendidos e tempo de entrega consideram só pedidos `delivered`, pela data da entrega (a transição para `delivered`).

---

## Autenticação e autorização

1. `POST /api/auth/login` devolve o **access token** (JWT HS256, 15 min) no corpo e o **refresh token** (7 dias) **somente** num cookie `httpOnly`, `SameSite=Strict`, `Path=/api/auth` (`Secure` em produção). O refresh token nunca fica acessível ao JavaScript do frontend.
2. As rotas protegidas exigem `Authorization: Bearer <accessToken>`.
3. `POST /api/auth/refresh` (com o cookie) rotaciona a sessão: o refresh token antigo deixa de valer. Reusar um token já rotacionado revoga a sessão inteira (sinal de roubo).

Respostas: `401 INVALID_TOKEN` / `TOKEN_EXPIRED` sem token, com token inválido ou vencido; `403 FORBIDDEN` sem permissão.

Proteções:
- Senhas em **bcrypt** (custo mínimo 10, checado também por constraint no banco).
- **Rate limit** de 100 requisições/min por IP, compartilhado entre réplicas via Redis (`429 RATE_LIMIT_EXCEEDED`, com `Retry-After`).
- **Limite de tentativas de login** por email + IP (`429 TOO_MANY_LOGIN_ATTEMPTS`).
- O tempo de resposta do login não revela se o email existe.

---

## Erros

Todas as respostas de erro seguem o mesmo formato:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [{ "field": "price", "message": "O preço deve ser maior que zero" }]
  }
}
```

| HTTP | Códigos principais |
|---|---|
| 400 | `VALIDATION_ERROR` (todos os campos inválidos de uma vez; itens com índice, ex.: `items.1.quantity`) |
| 401 | `INVALID_CREDENTIALS`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `INVALID_REFRESH_TOKEN` |
| 403 | `FORBIDDEN` |
| 404 | `PRODUCT_NOT_FOUND`, `ORDER_NOT_FOUND`, `DELIVERY_PERSON_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | `PRODUCT_IN_USE`, `DELIVERY_PERSON_IN_USE`, `EMAIL_ALREADY_IN_USE` |
| 422 | `INVALID_STATUS_TRANSITION`, `UNAVAILABLE_PRODUCT`, `DELIVERY_PERSON_UNAVAILABLE`, `ASSIGNMENT_NOT_ALLOWED` |
| 429 | `RATE_LIMIT_EXCEEDED`, `TOO_MANY_LOGIN_ATTEMPTS` |
| 500 | `INTERNAL_ERROR` (o detalhe vai só para o log) |

---

## Tempo real (WebSocket)

Endpoint: `ws://localhost:3002/realtime`. A origem do navegador precisa estar em `REALTIME_ALLOWED_ORIGINS`; outra origem é recusada no handshake (`403`).

1. Depois de conectar, o cliente tem **5 s** para enviar `{ "type": "auth", "accessToken": "<access token>" }` (o navegador não envia `Authorization` em WebSocket, e token na URL vazaria em logs).
2. O servidor responde `{ "type": "ready", "expiresAt": "…" }` e passa a enviar os eventos:

```json
{
  "type": "event",
  "id": "4bc3775b-…",
  "topic": "ordering.order-updates",
  "occurredAt": "2026-10-17T17:45:42.298Z",
  "payload": { "type": "order.placed", "orderId": "…", "status": "pending", "totalAmount": 14.5 }
}
```

Tópicos e tipos de `payload.type`:

- `ordering.order-updates`: `order.placed`, `order.status-changed` (com `previousStatus`, `status`, `deliveryPersonId`) e `order.delivery-person-assigned`. Dados pessoais do cliente não trafegam pelo canal.
- `catalog.product-updates`: `product.created`, `product.updated`, `product.price-changed`, `product.availability-changed` (com `isAvailable`) e `product.removed`, todos com `productId`. O painel recarrega os dados pela API.

3. Um novo `auth` com o token renovado estende a conexão; quando o token vence, o servidor fecha com `4401`.

| Código de fechamento | Significado |
|---|---|
| `4400` | Mensagem fora do protocolo |
| `4401` | Sem autenticação no prazo, token inválido ou expirado |
| `4403` | Sem permissão `orders:read` |
| `1012` | Servidor reiniciando (reconectar) |
| `1013` | Cliente lento demais (reconectar e recarregar) |

A entrega é **pelo menos uma vez**: o cliente descarta repetidos pelo `id` e, ao reconectar, recarrega a lista pela API (o pub/sub não guarda mensagens perdidas durante a desconexão).

---

## Mensageria (SNS + SQS)

O relay publica cada mensagem do outbox **uma vez**, no tópico SNS `fastmeals-events`, com o tópico lógico (`ordering.order-updates`, `catalog.product-updates`) no atributo `topic`. Publica **em lote**: o lote do outbox (até 100 mensagens) vira chamadas `PublishBatch` de até 10 mensagens e 256 KiB, 5 em paralelo, com resultado por mensagem; uma que falha fica pendente sem segurar as outras. Cada consumidor tem a **própria fila SQS** assinada no tópico, com filtro e fila morta próprios; um consumidor novo (e-mail, analytics) é só mais uma fila, sem mexer no relay.

| Recurso | Nome | Papel |
|---|---|---|
| Tópico SNS | `fastmeals-events` | Recebe tudo o que sai do outbox |
| Fila SQS | `fastmeals-realtime` | Assinada no tópico com filtro pelos tópicos do painel e entrega crua (o corpo é o envelope); visibility timeout de 30 s |
| Fila morta | `fastmeals-realtime-dlq` | Recebe do SQS a mensagem que falhou 5 vezes; guarda por 14 dias |

Em desenvolvimento e nos testes, tudo roda no **[Floci](https://floci.io)** (emulador local da AWS, em `http://localhost:4566`), criado pelo job `messaging-setup` ([`messaging-setup.ts`](src/main/messaging-setup.ts)), que pode rodar de novo sem efeito. Em produção, o mesmo código fala com a AWS: basta não definir `AWS_ENDPOINT_URL` e declarar os recursos na infraestrutura como código.

O gateway lê a fila com long polling e, para cada mensagem, publica o envelope no Redis e só então a apaga. Se não conseguir (Redis fora, envelope inválido), não apaga: a mensagem reaparece depois do visibility timeout e, no 5º recebimento, o próprio SQS a move para a fila morta. A fila entrega cada mensagem a uma réplica do gateway; o Redis a espalha para todas.

### Duas filas mortas

| Onde falha | Fila morta | Listar | Devolver |
|---|---|---|---|
| **Publicar** (o SNS recusa a mensagem) | coluna `dead_lettered_at` do outbox | `npm run outbox:dead-letters` | `npm run outbox:redrive -- --all` |
| **Consumir** (o gateway não consegue repassar) | SQS `fastmeals-realtime-dlq` | `npm run events:dead-letters` | `npm run events:redrive` |

No Docker: `docker compose run --rm --no-deps outbox-relay node dist/outbox-redrive.js list` e `docker compose run --rm --no-deps realtime node dist/events-dead-letters.js list` (ou `redrive`).

### Fila morta do outbox

O relay separa dois tipos de falha:

- **Broker fora** (SNS inalcançável, throttling, erro 5xx, credenciais): espera com backoff e tenta de novo, **sem contar tentativa**. Uma queda longa não mata nenhuma mensagem.
- **Falha da mensagem** (o SNS a recusou: `InvalidParameter`, por exemplo, mensagem grande demais): soma uma tentativa. Na `OUTBOX_MAX_ATTEMPTS`-ésima (padrão 5), a mensagem ganha `dead_lettered_at` e o erro em `last_error`, sai da fila e as seguintes continuam sendo entregues. O relay registra um log `error` ("Mensagem do outbox enviada para a fila morta").

As mensagens mortas não são apagadas pela retenção. Depois de corrigir a causa, devolva-as à fila; elas voltam com as tentativas zeradas:

```bash
npm run outbox:dead-letters                    # lista, com o último erro
npm run outbox:redrive -- --id <uuid>          # devolve uma
npm run outbox:redrive -- --all                # devolve todas
```

No Docker: `docker compose run --rm --no-deps outbox-relay node dist/outbox-redrive.js list` (ou `redrive --all`).

---

## Variáveis de ambiente

Exemplo completo em [`.env.example`](../.env.example). Cada processo valida as suas no boot e falha com uma mensagem clara se algo estiver errado.

| Variável | Processos | Padrão | Descrição |
|---|---|---|---|
| `DATABASE_URL` | API, relay, seed, migrate | — | Conexão PostgreSQL |
| `REDIS_URL` | API, gateway | — | Conexão Redis |
| `JWT_SECRET` | API, gateway | — | Segredo do access token (32+ caracteres) |
| `JWT_REFRESH_SECRET` | API | — | Segredo do refresh token (32+, diferente do anterior) |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | API | `15m` / `7d` | Validade dos tokens |
| `PORT` / `HOST` | API | `3001` / `0.0.0.0` | Endereço da API |
| `COOKIE_SECURE` | API | `true` em produção | `false` só em desenvolvimento sem HTTPS |
| `TRUST_PROXY` | API | vazio | Proxies confiáveis (IPs/CIDRs ou nº de saltos) para o IP real no rate limit |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | API | `100` / `60000` | Rate limit por IP |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MS` | API | `5` / `60000` | Tentativas de login por email + IP |
| `BCRYPT_COST` | API, seed | `10` | Custo do bcrypt (10–15) |
| `OUTBOX_POLL_INTERVAL_MS` / `OUTBOX_BATCH_SIZE` | relay | `500` / `100` | Latência máxima e tamanho do lote |
| `OUTBOX_MAX_ATTEMPTS` | relay | `5` | Falhas permanentes de uma mensagem até a fila morta |
| `RELAY_HEALTH_PORT` | relay | `3003` | Porta interna do health check |
| `AWS_REGION` | relay, gateway, setup | `us-east-1` | Região AWS |
| `AWS_ENDPOINT_URL` | relay, gateway, setup | vazio (AWS real) | Endpoint do emulador (`http://localhost:4566` com o Floci) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | relay, gateway, setup | cadeia padrão do SDK | Credenciais (`test` / `test` no Floci) |
| `EVENTS_TOPIC_ARN` | relay | — | ARN do tópico SNS de eventos |
| `EVENTS_TOPIC_NAME` | setup | `fastmeals-events` | Nome do tópico a criar |
| `REALTIME_QUEUE_NAME` / `REALTIME_DLQ_NAME` | gateway, setup | `fastmeals-realtime` / `fastmeals-realtime-dlq` | Fila do tempo real e a fila morta dela |
| `REALTIME_MAX_RECEIVE_COUNT` | setup | `5` | Recebimentos sem sucesso até a fila morta do SQS |
| `REALTIME_VISIBILITY_TIMEOUT_SECONDS` | setup | `30` | Quanto a mensagem fica invisível enquanto é processada |
| `REALTIME_PORT` | gateway | `3002` | Porta do WebSocket |
| `REALTIME_ALLOWED_ORIGINS` | gateway | `http://localhost:3000` | Origens de navegador aceitas (separadas por vírgula) |
| `SEED_FILE` | seed | `seed/data.json` da raiz | Arquivo de dados do seed |

---

## Scripts

| Script | O que faz |
|---|---|
| `npm run docker:up` / `docker:down` / `docker:reset` / `docker:logs` | Backend completo no Docker (ver [Como rodar](#como-rodar)) |
| `npm run dev` | API com recarga automática (tsx watch) |
| `npm run dev:relay` / `npm run dev:realtime` | Worker do outbox / gateway WebSocket com recarga |
| `npm run seed` | Aplica as migrations e popula o banco (`-- --reset` para recriar) |
| `npm run migrate:latest` / `npm run migrate:down` | Aplica as migrations pendentes / desfaz a última |
| `npm run messaging:setup` | Cria tópico, filas, fila morta e assinatura (Floci ou AWS) |
| `npm run outbox:dead-letters` / `npm run outbox:redrive` | Lista / devolve à fila as mensagens mortas do outbox (ver [Duas filas mortas](#duas-filas-mortas)) |
| `npm run events:dead-letters` / `npm run events:redrive` | Lista / devolve à fila do tempo real as mensagens mortas do SQS |
| `npm run build` | Bundles de produção em `dist/` (`server`, `outbox-relay`, `outbox-redrive`, `realtime-gateway`, `messaging-setup`, `events-dead-letters`, `migrate`, `seed`) |
| `npm start`, `start:relay`, `start:realtime`, `start:migrate`, `start:seed` | Rodam os bundles de `dist/` |
| `npm test`, `test:unit`, `test:architecture`, `test:integration`, `test:e2e`, `test:watch` | Testes |
| `npm run typecheck` | Verificação de tipos |

---

## Estrutura de pastas

```
backend/src/
├── catalog/            produtos
├── delivery/           entregadores e otimização de atribuição
├── identity/           usuários, login, sessões, JWT
├── ordering/           pedidos
├── reporting/          relatórios (só leitura)
├── realtime/           sessões WebSocket do painel
├── shared-kernel/      base comum (domínio, aplicação, infra, HTTP)
└── main/               entrypoints, configuração, migrations, seed, app HTTP

<contexto>/
├── domain/             agregados, value objects, eventos, erros, contratos de repositório
├── application/        casos de uso, DTOs, ports (ACLs), fakes de teste em testing/
├── infra/persistence/  schema/, migrations/, mappers/, repositories/, acl/, unit-of-work/
├── presentation/       controllers/ e routes/ (um arquivo por rota), testes e2e
└── main/               composition root do contexto
```
