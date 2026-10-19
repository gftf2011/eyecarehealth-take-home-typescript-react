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

Pronto: API em http://localhost:3001/api (documentação Swagger em http://localhost:3001/api/docs), WebSocket em ws://localhost:3002/realtime, login `admin@fastmeals.com` / `Admin@123`. Para parar: `npm run docker:down`.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Como rodar](#como-rodar)
- [Como testar](#como-testar)
- [Recursos da API](#recursos-da-api)
- [Documentação da API (Swagger)](#documentação-da-api-swagger)
- [Autenticação e autorização](#autenticação-e-autorização)
- [Erros](#erros)
- [Tempo real (WebSocket)](#tempo-real-websocket)
- [Mensageria (SNS + SQS)](#mensageria-sns--sqs)
- [Observabilidade (OpenTelemetry)](#observabilidade-opentelemetry)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Estrutura de pastas](#estrutura-de-pastas)

---

## Arquitetura

### Quatro processos, um código

O mesmo código (e a mesma imagem Docker) roda em quatro processos independentes:

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
                                                    SNS fastmeals-events.fifo (grupo = agregado)
                                                                  │ assinatura (filtro por tópico, entrega crua)
                                                                  ▼
                         SQS fastmeals-realtime.fifo ──5 recebimentos sem sucesso──► SQS fastmeals-realtime-dlq.fifo
                                                                  │ long polling (uma réplica recebe)
                                                                  ▼
 painel <──WebSocket──  realtime :3002  ──PUBLISH/SUBSCRIBE──  Redis pub/sub (todas as réplicas recebem)
                        (realtime-gateway.ts)

   SNS ── assinatura (só delivery.delivery-person-updates) ──► SQS fastmeals-ordering.fifo (+ fastmeals-ordering-dlq.fifo)
                                                                  │ long polling
                                                                  ▼
                           event-consumers (event-consumers.ts) ── caso de uso do Ordering ──► PostgreSQL
```

| Processo | Entrypoint | Responsabilidade | Depende de |
|---|---|---|---|
| **API** | `src/main/server.ts` | REST, autenticação, regras de negócio; grava eventos de integração no outbox | PostgreSQL, Redis (rate limit), segredos JWT |
| **Outbox relay** | `src/main/outbox-relay.ts` | Publica as mensagens confirmadas do outbox no tópico SNS; retentativa com backoff; fila morta do outbox; limpeza após 7 dias | PostgreSQL, SNS |
| **Realtime gateway** | `src/main/realtime-gateway.ts` | Consome a fila SQS do tempo real, espalha cada evento pelo Redis entre as réplicas e o repassa aos painéis por WebSocket autenticado | SQS, Redis, segredo do access token |
| **Consumidores de eventos** | `src/main/event-consumers.ts` | Reações de um contexto aos eventos de outro, cada uma com a própria fila: o Ordering tira dos pedidos que não saíram o entregador desativado ou removido ([ver abaixo](#entregador-desativado-ou-removido)) | PostgreSQL, SQS |

Dois jobs de uma execução preparam o ambiente: `migrate` (migrations) e `messaging-setup` (tópico, filas, fila morta e assinatura; ver [Mensageria](#mensageria-sns--sqs)).

Por que separados: conexões longas (WebSocket) e os workers não competem com a API, cada um escala e reinicia sozinho, e um deploy da API não derruba os painéis. O relay pode ter várias réplicas (lotes disjuntos via `SKIP LOCKED`); o gateway também (a fila divide as mensagens entre as réplicas, e o Redis as leva a todas).

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

Sobe, nesta ordem: `postgres`, `redis` e `floci` → `migrate` (aplica as migrations e sai) → `messaging-setup` (cria tópico SNS, filas SQS e assinatura, e sai) e `seed` (popula com `seed/data.json` e sai) → `api`, `outbox-relay`, `realtime` e `event-consumers`. Todos têm health check. A imagem é construída uma vez (pelo `migrate`) com a raiz do repositório como contexto (ela leva o `seed/data.json`), filtrada por [`Dockerfile.dockerignore`](Dockerfile.dockerignore), que só deixa entrar `backend/` e `seed/`; os outros serviços reaproveitam a mesma imagem.

| Serviço | URL |
|---|---|
| API | http://localhost:3001/api |
| Health da API | http://localhost:3001/api/health |
| Swagger UI / OpenAPI | http://localhost:3001/api/docs / http://localhost:3001/api/docs/json |
| WebSocket | ws://localhost:3002/realtime |
| Health do gateway | http://localhost:3002/health |
| PostgreSQL | `localhost:5432` (usuário `fastmeals` / senha `fastmeals123`) |
| Redis | `localhost:6379` |
| Floci (SNS/SQS) | http://localhost:4566 (credenciais `test` / `test`) |
| Grafana (métricas, logs e traces) | http://localhost:3300/d/fastmeals |

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

```bash
npm run dev:consumers          # consumidores de eventos (ex.: entregador desativado)
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
npm run lint               # oxlint com regras de tipo (promises esquecidas, any, sort sem comparador…)
```

> **Integração e e2e exigem Docker em execução.** O Vitest sobe PostgreSQL 17, Redis 7 e Floci (SNS/SQS) descartáveis com Testcontainers (uma vez por execução), aplica as migrations reais e destrói tudo ao final. Nada é configurado à mão.

### Tipos de teste

O tipo está no nome do arquivo, ao lado do código testado:

| Sufixo | O que cobre | Arquivos |
|---|---|---|
| `*.unit.spec.ts` | Domínio e casos de uso com fakes em memória; sem I/O | 91 |
| `*.integration.spec.ts` | Repositórios, ACLs, consultas, outbox, Redis, SNS/SQS, seed, migrations — contra dependências reais | 21 |
| `*.e2e.spec.ts` | Requisições HTTP reais na API (`app.inject`) e clientes WebSocket reais no gateway | 13 |
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

**Onde o cálculo roda.** O Húngaro é O(k²·K): milissegundos para dezenas de pedidos, mas ~2 s com 1000 × 1000. Para a API não travar nesse tempo (login, listagens e o próprio health check), problemas com mais de `OPTIMIZER_INLINE_MAX_CELLS` células (pedidos × entregadores, padrão 10.000) vão para um **pool de `worker_threads`** (núcleos − 1, no máximo 2). Os pequenos continuam na thread da requisição, onde enviar para um worker custaria mais que o cálculo.

- **Fila limitada:** com os workers ocupados e `OPTIMIZER_MAX_QUEUED` esperando, a resposta é `503 OPTIMIZER_BUSY` na hora.
- **Tempo limite:** um cálculo acima de `OPTIMIZER_TIMEOUT_MS` (padrão 10 s) é interrompido (`503 OPTIMIZER_TIMEOUT`), e o worker é recriado.
- **Pedidos simultâneos iguais** (vários gestores clicando em "Sugerir" com o mesmo quadro) dividem um só cálculo.
- **Boot:** a API só começa a atender depois que os workers carregaram. Se o worker não subir (build sem `dist/dispatch-planner.worker.js`), a API falha no boot em vez de girar recriando workers.
- `executionTimeMs` mede o algoritmo em si, sem fila nem transporte entre threads.

### Entregadores

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| `GET` | `/delivery-persons` | `delivery-persons:read` | `isActive`, `available` (sem pedido `delivering`); cada item traz `currentOrderId` |
| `POST` | `/delivery-persons` | `delivery-persons:write` | `{ name, phone, vehicleType, isActive?, currentLatitude?, currentLongitude? }` → `201` |
| `PUT` | `/delivery-persons/:id` | `delivery-persons:write` | Atualização parcial (dados, ativação, localização; as duas coordenadas `null` apagam a posição) |
| `DELETE` | `/delivery-persons/:id` | `delivery-persons:write` | Soft delete → `204`; `409 DELIVERY_PERSON_IN_USE` se estiver em entrega |

#### Entregador desativado ou removido

Desativar (ou remover) um entregador **não** mexe na entrega que ele já está fazendo: o pedido `delivering` segue com ele até `delivered`. Os pedidos que ainda não saíram (`pending`, `preparing`, `ready`) e estavam atribuídos a ele **perdem o entregador e voltam para a atribuição**, em geral em menos de 1 s:

1. O Delivery publica `delivery-person.activation-changed` (ou `delivery-person.removed`) pelo outbox.
2. O SNS entrega a mensagem à fila do Ordering (`fastmeals-ordering.fifo`), que só assina esse tópico.
3. O processo `event-consumers` chama o caso de uso [`ReleaseDeliveryPersonOrders`](src/ordering/application/usecases/release-delivery-person-orders/release-delivery-person-orders.usecase.ts), que confere o estado **atual**: se o entregador foi reativado nesse meio-tempo, nada muda.
4. Cada pedido liberado publica `order.delivery-person-unassigned`, e o quadro de atribuição atualiza sozinho.

Antes disso terminar, nada sai errado: despachar com o entregador inativo já é recusado (`422 DELIVERY_PERSON_UNAVAILABLE`), e a sugestão do otimizador só considera entregadores ativos.

### Relatórios

| Método | Rota | Parâmetros | Base de data |
|---|---|---|---|
| `GET` | `/reports/revenue` | `startDate`, `endDate` **obrigatórios** (até 366 dias) | Entrega |
| `GET` | `/reports/orders-by-status` | período opcional | Criação |
| `GET` | `/reports/top-products` | período opcional, `limit` (padrão 10, de 1 a 100) | Entrega |
| `GET` | `/reports/average-delivery-time` | período opcional | Entrega |

Todos exigem `reports:read`. Receita, mais vendidos e tempo de entrega consideram só pedidos `delivered`, pela data da entrega (a transição para `delivered`).

---

## Documentação da API (Swagger)

| O quê | Onde |
|---|---|
| Swagger UI | http://localhost:3001/api/docs (ou http://localhost:3000/api/docs, pelo nginx do painel) |
| OpenAPI 3.1 (JSON) | http://localhost:3001/api/docs/json |

Para testar pelo navegador: em **Autenticação → `POST /api/auth/login`**, *Execute* (o exemplo já vem com o admin do seed). Copie o `accessToken` da resposta, clique em **Authorize** e cole o token. As outras rotas passam a mandar `Authorization: Bearer …`.

**Gerado do código, não escrito à mão.** Cada rota declara um `docs` (resumo, tags, schemas de parâmetros, query, corpo e respostas), obrigatório no tipo `Route`: uma rota nova sem documentação não compila. Os schemas são os **mesmos schemas Zod** que os controllers usam para validar a entrada (em `<contexto>/presentation/schemas/`), convertidos para JSON Schema com `z.toJSONSchema`. O gerador ([`build-openapi-document.ts`](src/shared-kernel/presentation/openapi/build-openapi-document.ts)) acrescenta sozinho:

- a permissão exigida (`x-permission` e na descrição) e o `bearerAuth`, ou `security: []` nas rotas públicas;
- as respostas comuns no formato de erro da API: `400` (quando a rota valida algo), `401` e `403` (rotas protegidas), `429` e `500`.

**Três testes impedem que a documentação minta:**

| Teste | Garante |
|---|---|
| `api-docs.e2e.spec.ts` | O documento é OpenAPI 3.1 válido (`@apidevtools/swagger-parser`), cada rota registrada está documentada (e nada além delas), e `API_DOCS_ENABLED=false` responde `404` |
| `api-contract.e2e.spec.ts` | Cada rota com corpo de sucesso é chamada de verdade e a resposta passa no schema **estrito** documentado: um campo a mais, a menos ou de outro tipo derruba o teste. O último caso confere que nenhuma rota ficou sem verificação |
| `build-openapi-document.unit.spec.ts` | O gerador: caminhos `{id}`, parâmetros obrigatórios, segurança e respostas comuns |

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

- `ordering.order-updates`: `order.placed`, `order.status-changed` (com `previousStatus`, `status`, `deliveryPersonId`), `order.delivery-person-assigned` e `order.delivery-person-unassigned` (com `previousDeliveryPersonId`: o entregador foi desativado ou removido). Dados pessoais do cliente não trafegam pelo canal.
- `catalog.product-updates`: `product.created`, `product.updated`, `product.price-changed`, `product.availability-changed` (com `isAvailable`) e `product.removed`, todos com `productId`. O painel recarrega os dados pela API.
- `delivery.delivery-person-updates`: `delivery-person.registered`, `delivery-person.updated`, `delivery-person.relocated`, `delivery-person.activation-changed` (com `isActive`) e `delivery-person.removed`, todos com `deliveryPersonId`. Sem nome, telefone nem coordenadas: o canal é o mesmo para todos os perfis, e os dados vêm pela API, que exige `delivery-persons:read`.

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

O relay publica cada mensagem do outbox **uma vez**, no tópico SNS **FIFO** `fastmeals-events.fifo`, com o tópico lógico (`ordering.order-updates`, `catalog.product-updates`, `delivery.delivery-person-updates`) no atributo `topic`. Publica **em lote**: o lote do outbox (até 100 mensagens) vira chamadas `PublishBatch` de até 10 mensagens e 256 KiB, 5 em paralelo, com resultado por mensagem; uma que falha fica pendente e segura só as seguintes do mesmo agregado. Cada consumidor tem a **própria fila SQS** assinada no tópico, com filtro e fila morta próprios; um consumidor novo (e-mail, analytics) é só mais uma fila, sem mexer no relay.

| Recurso | Nome | Papel |
|---|---|---|
| Tópico SNS FIFO | `fastmeals-events.fifo` | Recebe tudo o que sai do outbox, com deduplicação explícita e vazão por grupo |
| Fila SQS FIFO | `fastmeals-realtime.fifo` | Assinada no tópico com filtro pelos tópicos do painel e entrega crua (o corpo é o envelope); visibility timeout de 30 s |
| Fila morta FIFO | `fastmeals-realtime-dlq.fifo` | Recebe do SQS a mensagem que falhou 5 vezes; guarda por 14 dias |
| Fila SQS FIFO | `fastmeals-ordering.fifo` | Do Ordering: só `delivery.delivery-person-updates`; mesmos limites da do tempo real |
| Fila morta FIFO | `fastmeals-ordering-dlq.fifo` | Mudança da frota que o Ordering não conseguiu aplicar 5 vezes (banco fora, contrato incompatível) |

Em desenvolvimento e nos testes, tudo roda no **[Floci](https://floci.io)** (emulador local da AWS, em `http://localhost:4566`), criado pelo job `messaging-setup` ([`messaging-setup.ts`](src/main/messaging-setup.ts)), que pode rodar de novo sem efeito. Em produção, o mesmo código fala com a AWS: basta não definir `AWS_ENDPOINT_URL` e declarar os recursos na infraestrutura como código.

O gateway lê a fila com long polling e, para cada mensagem, publica o envelope no Redis e só então a apaga. Se não conseguir (Redis fora, envelope inválido), não apaga: a mensagem reaparece depois do visibility timeout e, no 5º recebimento, o próprio SQS a move para a fila morta. A fila entrega cada mensagem a uma réplica do gateway; o Redis a espalha para todas.

### FIFO: ordem por agregado e deduplicação

| Onde | Como |
|---|---|
| Outbox | Coluna `sequence` (identity): a ordem de inserção, confiável mesmo quando os relógios de duas transações empatam ou se invertem |
| Relay | Advisory lock por agregado (`pg_try_advisory_xact_lock`): duas réplicas nunca publicam o mesmo pedido ao mesmo tempo; agregados diferentes continuam divididos |
| SNS | `MessageGroupId` = agregado (`ordering.order:<id>`); `MessageDeduplicationId` = id do outbox, então uma republicação (commit que falhou depois do envio) é descartada em 5 minutos |
| Publisher | Cada agregado numa faixa sequencial (as faixas correm em paralelo); no máximo uma mensagem por agregado em cada `PublishBatch`; uma falha adia (`deferred`) as seguintes do mesmo agregado |
| SQS | Fila e fila morta FIFO, com `DeduplicationScope=messageGroup` e `FifoThroughputLimit=perMessageGroupId` (alta vazão) |
| Gateway | Processa o lote em ordem; se uma mensagem falha, as seguintes do mesmo grupo no lote nem são processadas nem apagadas |

Pedidos diferentes andam em paralelo. Um pedido com uma mensagem que sempre falha fica parado até ela ir para a fila morta (5 tentativas no relay ou 5 recebimentos no SQS); depois, o grupo destrava.

### Duas filas mortas

| Onde falha | Fila morta | Listar | Devolver |
|---|---|---|---|
| **Publicar** (o SNS recusa a mensagem) | coluna `dead_lettered_at` do outbox | `npm run outbox:dead-letters` | `npm run outbox:redrive -- --all` |
| **Consumir** (o gateway não consegue repassar) | SQS `fastmeals-realtime-dlq.fifo` | `npm run events:dead-letters` | `npm run events:redrive` |
| **Consumir** (o Ordering não consegue aplicar) | SQS `fastmeals-ordering-dlq.fifo` | `npm run events:dead-letters -- ordering` | `npm run events:redrive -- ordering` |

No Docker: `docker compose run --rm --no-deps outbox-relay node dist/outbox-redrive.js list` e `docker compose run --rm --no-deps realtime node dist/events-dead-letters.js list` (ou `redrive`; acrescente `ordering` para a fila do Ordering).

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

## Observabilidade (OpenTelemetry)

API, relay e gateway exportam **traces, métricas e logs** por OTLP. O SDK é pré-carregado antes da aplicação ([`instrumentation.ts`](src/main/telemetry/instrumentation.ts), `node --import ./dist/instrumentation.js`) e instrumenta HTTP, Fastify, `pg`, `ioredis` e pino. No Compose, tudo vai para o serviço `otel-lgtm` (OTel Collector, Prometheus, Loki, Tempo e Grafana numa imagem):

| O quê | Onde |
|---|---|
| Grafana com o dashboard **FastMeals** | http://localhost:3300/d/fastmeals |
| OTLP para processos fora do Docker (`npm run dev`) | `http://localhost:4318` |

### Um trace por ação, por todos os processos

O contexto do trace da requisição é gravado no outbox junto com o evento (coluna `trace_context`). O relay publica cada mensagem num span de **produtor** filho dele e leva o `traceparent` nos atributos da mensagem SNS; o gateway processa a mensagem da fila num span de **consumidor** filho do produtor. Uma mudança de status no painel aparece, no Tempo, como um trace só:

```
PATCH /api/orders/:id/status   (fastmeals-api: handler, BEGIN/SELECT/INSERT no outbox/COMMIT)
└─ publish ordering.order-updates   (fastmeals-outbox-relay)
   └─ process fastmeals-realtime.fifo   (fastmeals-realtime: PUBLISH no Redis)
```

Desativar um entregador com pedidos atribuídos segue o mesmo caminho e continua no `fastmeals-event-consumers` (`process fastmeals-ordering.fifo`, com as escritas no banco), até a mensagem `order.delivery-person-unassigned` chegar ao painel.

O ciclo do relay também é um span (`outbox relay batch`), ligado aos traces das mensagens que publicou.

**Sem ruído de fundo.** O relay consulta o banco a cada 500 ms e o gateway faz long polling na fila; banco, Redis e HTTP de saída só geram spans dentro de um trace que já existe, e health checks e o upgrade do WebSocket não abrem traces.

### Logs

O pino continua escrevendo JSON no stdout e envia cada log também por OTLP, com `trace_id` e `span_id`. No Grafana, de um log se abre o trace (Loki → Tempo), e de um span se veem os logs dele (Tempo → Loki).

### Métricas

| Métrica | Tipo | Atributos | Para quê |
|---|---|---|---|
| `fastmeals.http.server.request.duration` | histograma (ms) | método, **rota** (`/api/orders/:id`), status | Vazão, latência p95 e erros por rota; 401 de login, 429 do rate limit e 503 do otimizador no mesmo gráfico |
| `fastmeals.orders.placed` | contador | — | Pedidos criados, contados **depois do commit** |
| `fastmeals.orders.status_changes` | contador | status de origem e de destino | Funil de pedidos |
| `fastmeals.outbox.pending` / `.oldest_pending.age` / `.dead_lettered` | gauge | — | Fila do outbox, atraso até o painel e fila morta |
| `fastmeals.outbox.messages.published` / `.failed` / `.dead_lettered` | contador | tópico / motivo | Saída do relay |
| `fastmeals.outbox.delivery.lag` / `.batch.duration` | histograma (ms) | tópico | Do evento até o SNS; duração de cada ciclo |
| `fastmeals.queue.messages.processed` | contador | fila, resultado | Consumo da fila do tempo real (falhas voltam para a fila) |
| `fastmeals.realtime.connections` | gauge | `open` / `authenticated` | Painéis conectados por réplica |
| `fastmeals.realtime.events.forwarded` | contador | tópico | Eventos espalhados entre as réplicas |
| `fastmeals.optimizer.duration` | histograma (ms) | modo (`inline` / `worker`) | Tempo do algoritmo |
| `fastmeals.optimizer.pool.load` / `.rejections` | gauge / contador | estado / motivo | Ocupação do pool e 503 (ocupado, timeout) |

As métricas de negócio do Ordering passam por uma porta (`OrderingMetrics`): a aplicação diz o que aconteceu, e o adapter do OpenTelemetry mede. Elas são registradas por um handler de eventos de domínio que agenda o efeito com `afterCommit`: um caso de uso desfeito não entra na conta.

### Configuração

Variáveis padrão do OpenTelemetry: `OTEL_SERVICE_NAME` (no Compose, `fastmeals-api`, `fastmeals-outbox-relay` e `fastmeals-realtime`), `OTEL_EXPORTER_OTLP_ENDPOINT` (qualquer backend OTLP: Grafana Cloud, Datadog, Honeycomb…), `OTEL_METRIC_EXPORT_INTERVAL` (padrão 15 s) e `OTEL_SDK_DISABLED=true` para desligar. Sem o SDK (testes, stack do Playwright), a API do OpenTelemetry vira no-op: nada é medido nem exportado, sem custo.

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
| `OPTIMIZER_WORKERS` | API | núcleos − 1 (máx. 2) | Workers do otimizador de atribuição |
| `OPTIMIZER_MAX_QUEUED` | API | `4` | Sugestões esperando um worker; além disso, `503 OPTIMIZER_BUSY` |
| `OPTIMIZER_TIMEOUT_MS` | API | `10000` | Tempo máximo de uma sugestão; depois, `503 OPTIMIZER_TIMEOUT` |
| `OPTIMIZER_INLINE_MAX_CELLS` | API | `10000` | Até quantas células (pedidos × entregadores) calcular na thread da API |
| `API_DOCS_ENABLED` | API | `true` | `false` tira do ar o Swagger UI e o OpenAPI (`/api/docs`) |
| `BCRYPT_COST` | API, seed | `10` | Custo do bcrypt (10–15) |
| `OUTBOX_POLL_INTERVAL_MS` / `OUTBOX_BATCH_SIZE` | relay | `500` / `100` | Latência máxima e tamanho do lote |
| `OUTBOX_MAX_ATTEMPTS` | relay | `5` | Falhas permanentes de uma mensagem até a fila morta |
| `OTEL_SERVICE_NAME` | API, relay, gateway | — | Nome do serviço nos traces, métricas e logs |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | API, relay, gateway | `http://localhost:4318` | Destino OTLP (no Compose, `http://otel-lgtm:4318`) |
| `OTEL_METRIC_EXPORT_INTERVAL` | API, relay, gateway | `15000` | Intervalo de exportação das métricas (ms) |
| `OTEL_SDK_DISABLED` | API, relay, gateway | `false` | `true` desliga a telemetria (no-op) |
| `RELAY_HEALTH_PORT` | relay | `3003` | Porta interna do health check |
| `EVENT_CONSUMERS_HEALTH_PORT` | consumidores | `3004` | Porta interna do health check |
| `AWS_REGION` | relay, gateway, setup | `us-east-1` | Região AWS |
| `AWS_ENDPOINT_URL` | relay, gateway, setup | vazio (AWS real) | Endpoint do emulador (`http://localhost:4566` com o Floci) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | relay, gateway, setup | cadeia padrão do SDK | Credenciais (`test` / `test` no Floci) |
| `EVENTS_TOPIC_ARN` | relay | — | ARN do tópico SNS FIFO de eventos (termina em `.fifo`) |
| `EVENTS_TOPIC_NAME` | setup | `fastmeals-events.fifo` | Nome do tópico FIFO a criar |
| `REALTIME_QUEUE_NAME` / `REALTIME_DLQ_NAME` | gateway, setup | `fastmeals-realtime.fifo` / `fastmeals-realtime-dlq.fifo` | Fila FIFO do tempo real e a fila morta dela (ambas FIFO) |
| `ORDERING_QUEUE_NAME` / `ORDERING_DLQ_NAME` | consumidores, setup | `fastmeals-ordering.fifo` / `fastmeals-ordering-dlq.fifo` | Fila FIFO do Ordering (mudanças na frota) e a fila morta dela |
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
| `npm run dev:relay` / `npm run dev:realtime` / `npm run dev:consumers` | Worker do outbox / gateway WebSocket / consumidores de eventos, com recarga |
| `npm run seed` | Aplica as migrations e popula o banco (`-- --reset` para recriar) |
| `npm run migrate:latest` / `npm run migrate:down` | Aplica as migrations pendentes / desfaz a última |
| `npm run messaging:setup` | Cria tópico, filas, fila morta e assinatura (Floci ou AWS) |
| `npm run outbox:dead-letters` / `npm run outbox:redrive` | Lista / devolve à fila as mensagens mortas do outbox (ver [Duas filas mortas](#duas-filas-mortas)) |
| `npm run events:dead-letters` / `npm run events:redrive` | Lista / devolve à fila de origem as mensagens mortas do SQS (do tempo real; `-- ordering` para a do Ordering) |
| `npm run build` | Bundles de produção em `dist/` (`server`, `dispatch-planner.worker`, `outbox-relay`, `outbox-redrive`, `realtime-gateway`, `event-consumers`, `messaging-setup`, `events-dead-letters`, `migrate`, `seed`) |
| `npm start`, `start:relay`, `start:realtime`, `start:consumers`, `start:migrate`, `start:seed` | Rodam os bundles de `dist/` |
| `npm test`, `test:unit`, `test:architecture`, `test:integration`, `test:e2e`, `test:watch` | Testes |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | Oxlint com regras de tipo ([`.oxlintrc.json`](.oxlintrc.json)); falha em qualquer aviso |

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
