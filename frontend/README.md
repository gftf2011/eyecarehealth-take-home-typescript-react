# FastMeals — Frontend

Painel administrativo da **FastMeals** em **React 19 + TypeScript** estrito. Mesma arquitetura do backend: um módulo por bounded context, Clean Architecture dentro de cada um, regras de negócio sem React e testes de arquitetura que impedem a estrutura de se degradar.

- **Vite 8**, **React 19**, **React Router 8**, **TanStack Query 5**, **Zod 4**, **Recharts 3** (gráficos), CSS Modules com design tokens (tema claro/escuro)
- Testes com **Vitest**, **Testing Library**, **MSW** (API simulada) e **ArchUnitTS**

> **Estado atual:**
> - **Identity**: login, sessão, renovação de token, rotas protegidas por sessão e permissão, logout.
> - **Catalog**: tela de produtos (`/produtos`) com busca por nome enquanto digita, filtros de categoria e disponibilidade na URL, tabela paginada, criar/editar em modal com validação em tempo real (as mesmas regras e mensagens da API), alternar disponibilidade na linha com atualização otimista e exclusão com confirmação (o `409 PRODUCT_IN_USE` sugere desativar em vez de excluir).
> - **Delivery**: tela de atribuição (`/atribuicao`, só para `orders:write`) com os pedidos prontos e os entregadores livres (sem GPS sinalizado), a sugestão do otimizador do backend (pares com distância, total em km, algoritmo e tempo de execução) e aceitar/rejeitar cada par ou aceitar todos. Aceitar despacha o pedido (`delivering`); uma sugestão desatualizada é marcada com o motivo da API sem afetar os outros pares.
> - **Reporting**: relatórios (`/relatorios`) com período na URL (atalhos de 7 dias, 30 dias e mês atual; até 366 dias, dias de São Paulo), resumo (receita, pedidos entregues, ticket médio, tempo médio de entrega), receita por dia (área), top 10 produtos (barras), pedidos por status (rosca) e tempo de entrega por veículo. Cada relatório carrega e falha sozinho, e cada gráfico tem uma tabela equivalente para leitores de tela.
> - **Realtime**: o painel fica conectado ao gateway WebSocket (selo "Ao vivo" no topo). Pedido criado ou alterado em qualquer lugar recarrega sozinho a lista de pedidos, o detalhe aberto e o quadro de atribuição. A conexão autentica pela primeira mensagem com o access token, reautentica quando o token renova, reconecta com backoff exponencial e aleatório (`4401` renova a sessão antes; `4403` desiste), descarta eventos repetidos e, ao voltar de uma queda, recarrega as telas.
> - **Ordering**: painel de pedidos (`/pedidos`, a página inicial) com filtros por status, período e ordenação guardados na URL, lista paginada, detalhe em modal com link próprio e botões de status contextuais (só as transições válidas; cancelar pede confirmação; despachar sem entregador fica bloqueado com o motivo; perfil `viewer` não vê ações).
>

## Início rápido

### Tudo com Docker (recomendado)

Na **raiz do repositório**, um comando sobe banco, Redis, backend e o painel:

```bash
docker compose up --build
```

Painel em **http://localhost:3000**. Para parar: `docker compose down` (os dados ficam no volume; `docker compose down --volumes` recria tudo do zero no próximo `up`).

### Desenvolvimento (Vite, com recarga)

Com o backend no ar (`cd backend && npm run docker:up`, que sobe só os serviços do backend do compose da raiz):

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Login: `admin@fastmeals.com` / `Admin@123` (acesso total) ou `viewer@fastmeals.com` / `Viewer@123` (somente leitura).

O Vite encaminha `/api` para `http://localhost:3001` e `/realtime` para `ws://localhost:3002`. O painel e a API ficam na **mesma origem**: o cookie do refresh token (`httpOnly`, `SameSite=Strict`, `Path=/api/auth`) funciona sem CORS. Para apontar para outro backend, use `API_PROXY_TARGET` / `REALTIME_PROXY_TARGET` (proxy) ou `VITE_API_BASE_URL` (URL da API no navegador).

### Imagem de produção

[`Dockerfile`](Dockerfile) multi-stage: instala, roda o `typecheck` e o build, e entrega só o `dist/` num **nginx sem root** ([`nginx/default.conf.template`](nginx/default.conf.template)) que:

- faz o proxy de `/api` e `/realtime` (WebSocket) para o backend na **mesma origem**, como o Vite em desenvolvimento;
- resolve os nomes dos serviços pelo DNS do Docker a cada 10 s (se a API reiniciar com outro IP, o proxy acompanha);
- devolve o `index.html` para qualquer rota do painel (SPA) e o revalida sempre, para um deploy novo valer na hora;
- serve os assets com hash em cache longo e imutável, com gzip;
- envia cabeçalhos de segurança: CSP restrita à própria origem (imagens de produtos podem vir de URLs `https`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` ([`nginx/security-headers.conf`](nginx/security-headers.conf)).

No [`docker-compose.yml`](../docker-compose.yml) da raiz (único para o projeto todo), a API confia em **um salto** de proxy (`TRUST_PROXY=1`), o nginx, que acrescenta o IP real ao `X-Forwarded-For`: o rate limit por IP enxerga o cliente real e um valor forjado pelo cliente é ignorado. As portas da API, do gateway, do Postgres e do Redis só abrem em `127.0.0.1`, então ninguém na rede fala com eles sem passar pelo painel. Nada depende de sub-rede ou IP fixo: o compose roda em qualquer máquina com Docker. Se a porta 3000 estiver ocupada, use `FRONTEND_PORT=8080 docker compose up --build` (a allowlist do WebSocket acompanha).

---

## Arquitetura

### Contextos e camadas

As pastas espelham os bounded contexts do backend (`identity`, `catalog`, `delivery`, `ordering`, `reporting` e `realtime`), mais o `shared-kernel` e a composição em `main/`:

```
src/
├── identity/            login, sessão, permissões
│   ├── domain/          Session, Email, Password, Role (matriz de permissões) — TypeScript puro
│   ├── application/     casos de uso (login, restaurar/renovar sessão, logout), ports, DTOs
│   ├── infra/           gateway HTTP, store da sessão, trava entre abas, agendador de renovação
│   ├── presentation/    componentes, páginas, hooks, rotas (React)
│   └── main/            composition root do contexto
├── catalog/             cardápio: Value Objects do produto, formulário, casos de uso, tela de produtos
├── delivery/            atribuição: AssignmentPlan (decisões por par), ACL dos pedidos prontos, tela de atribuição
├── ordering/            painel de pedidos: OrderStatus (máquina de estados), Order, filtros, casos de uso, telas
├── realtime/            tempo real: protocolo do gateway, LiveConnection (reauth, backoff, dedupe), selo "Ao vivo"
├── reporting/           relatórios: ReportPeriod (até 366 dias), casos de uso por relatório, gráficos
├── shared-kernel/       base comum: erros, validação, cliente HTTP, componentes de UI, tema
├── main/                entrypoint, roteador, layout, injeção das dependências
└── architecture/        testes de arquitetura (ArchUnitTS)
```

As dependências só apontam para dentro, como no backend:

```
main → presentation → application → domain
     → infra        ↗
```

- **domain**: regras sem bibliotecas, as mesmas da API (ex.: o email é normalizado; o perfil `viewer` só lê pedidos, produtos e relatórios).
- **application**: casos de uso que dependem de **ports** (`AuthGateway`, `SessionStore`, `SessionRenewalLock`); não conhecem React, `fetch` nem timers.
- **infra**: implementa os ports (HTTP com `fetch`, Web Locks API, `setTimeout`).
- **presentation**: React. Chama os casos de uso por hooks (TanStack Query para estado de servidor) e nunca a infra.
- Cada tela é carregada sob demanda (`React.lazy`): um chunk por rota no build, e o login não espera o código das outras telas.
- Eventos em tempo real passam por um canal do shared kernel (`LiveEventBus`): o Realtime publica e cada contexto assina o tópico que lhe interessa e invalida o próprio cache. O Realtime não conhece as telas.
- A invalidação (`useLiveInvalidation`) só recarrega as consultas que o evento afeta (regras por tela), junta rajadas em no máximo uma recarga por segundo (5 s nos relatórios) e, com a aba em segundo plano, só marca como desatualizado, recarregando quando ela volta a ficar visível.
- Contextos não se importam: as permissões da sessão chegam às telas de pedidos por um provider do shared kernel (`useCan`), montado em `main/` a partir do Identity.

### Sessão e segurança

| Decisão | Por quê |
|---|---|
| Access token **só em memória** | `localStorage` seria legível por um XSS. Um teste de arquitetura proíbe storage do navegador no código. |
| Refresh token só no cookie `httpOnly` | O JavaScript nunca o vê. Ao recarregar a página, a sessão é restaurada por `POST /auth/refresh`. |
| Renovação antes de vencer | O token é renovado 1 min antes de expirar enquanto o painel está aberto, e na hora se a API responder `401`. Várias requisições simultâneas compartilham **uma** renovação. |
| Trava entre abas (Web Locks API) | A API trata reuso de refresh token como roubo e revoga a sessão. Duas abas renovando juntas enviariam o mesmo cookie; a trava faz a segunda esperar e usar o cookie novo. |
| Sessão expirada → login com aviso | Se o refresh for recusado, o guard manda para `/login` com "Sua sessão expirou" e, após entrar, volta à página em que o usuário estava. |
| Permissões na interface | O menu e as telas usam a mesma matriz de perfis da API, mas quem autoriza de fato continua sendo a API (`403`). |

### Erros

O cliente HTTP traduz cada resposta de erro da API (`{ error: { code, message, details } }`) para a mesma categoria do backend: `InputValidationError` (400, com mensagens por campo), `UnauthenticatedError` (401), `ForbiddenError` (403), `ResourceNotFoundError` (404), `RequestConflictError` (409), `BusinessRuleRejectedError` (422), `RateLimitedError` (429, com `Retry-After`) e `ServiceUnavailableError` (rede, 5xx ou resposta fora do contrato, validada com Zod). As telas mostram a mensagem sem conhecer HTTP. Só falhas transitórias são repetidas automaticamente.

### Formulários

Os Value Objects do produto são os mesmos do backend, e os testes deles foram copiados do backend sem nenhuma mudança: se as regras divergirem entre os dois lados, o mesmo teste falha em um deles.

A validação em tempo real usa **as mesmas regras do caso de uso** (Value Objects): `loginInputErrors(values)` roda a cada digitação, e o erro de um campo aparece depois que ele é visitado ou numa tentativa de envio. Erros por campo vindos da API aparecem no próprio campo. Acessibilidade: `label` associado, `aria-invalid`, `aria-describedby` com a mensagem, foco no primeiro campo inválido e `role="alert"` nos erros.

---

## Como testar

```bash
npm test                   # todas as suítes
npm run test:unit          # domínio, casos de uso, infra e componentes
npm run test:integration   # telas inteiras com a API simulada (MSW)
npm run test:architecture  # regras de arquitetura (ArchUnitTS)
npm run test:e2e           # navegador de verdade contra o sistema inteiro (Playwright; exige Docker)
npm run typecheck          # tsc --noEmit (strict)
npm run typecheck:e2e      # tipos dos testes de ponta a ponta
```

| Sufixo | O que cobre |
|---|---|
| `*.unit.spec.ts(x)` | Value Objects, casos de uso com fakes, cliente HTTP (mapeamento de erros, renovação no `401`), provider de token (renovação única), trava entre abas, agendador (fake timers), componentes (renderização e interação) |
| `*.integration.spec.tsx` | O painel inteiro, montado como em `main.tsx`, com roteador em memória e a API atendida pelo **MSW**: login válido e inválido, retorno à página pedida, sessão restaurada no reload, sessão revogada → login com aviso, logout |
| `*.architecture.spec.ts` | Camadas, isolamento entre contextos, domínio sem bibliotecas, aplicação sem React/HTTP/APIs do navegador, segurança (sem storage, sem HTML cru, sem `document.cookie`), convenções de nomes e pastas |

Nenhum teste do Vitest chama a rede: o MSW recusa qualquer requisição sem handler.

### Ponta a ponta (Playwright)

Os testes em [`e2e/`](e2e) abrem o Chromium contra o **sistema inteiro**: nginx, API, gateway, relay, PostgreSQL, Redis e Floci. A pilha é **isolada**: o `global-setup` sobe o projeto `fastmeals-e2e` do mesmo `docker-compose.yml`, com portas próprias (painel em http://localhost:3100) e banco novo com o seed a cada rodada. No fim, apaga tudo. Os dados e a stack de desenvolvimento não são tocados.

```bash
npx playwright install chromium        # uma vez
npm run test:e2e                       # sobe a stack, roda e derruba (~1,5 min)
E2E_KEEP_STACK=1 npm run test:e2e      # mantém a stack no fim, para depurar
E2E_BASE_URL=http://localhost:3100 npm run test:e2e   # usa uma stack já de pé
npm run test:e2e:report                # relatório HTML (trace, vídeo e screenshot das falhas)
```

| Arquivo | Cobre |
|---|---|
| `auth.e2e.ts` | Login inválido e válido, logout encerrando a sessão no servidor, retorno à página pedida, sessão que sobrevive ao reload (cookie `httpOnly`, nada no `localStorage`), perfil somente leitura |
| `products.e2e.ts` | Cardápio do seed, criação com validação em tempo real, busca com filtro na URL, edição, pausar persistindo após o reload, exclusão confirmada |
| `orders.e2e.ts` | Lista e filtro por status pela URL, só transições válidas no detalhe, despacho que exige entregador |
| `assignment.e2e.ts` | Quadro de prontos e entregadores livres (o que está em entrega não aparece), sugestão pelo Húngaro com distâncias, aceitar despacha |
| `reports.e2e.ts` | As quatro métricas com os dados do seed, troca de período |
| `realtime.e2e.ts` | Dois gestores em navegadores separados: o produto pausado por um aparece pausado para o outro; pedido novo e mudança de status chegam sem recarregar, passando por outbox → SNS FIFO → SQS FIFO → gateway → WebSocket |

Cada teste entra pela API com **a própria sessão**: reaproveitar um cookie salvo (o `storageState` do Playwright) entre testes dispararia a detecção de reuso do refresh token rotativo, que revoga a sessão. Os testes que alteram dados criam os próprios pela API (com nomes únicos) e rodam em sequência sobre o mesmo banco.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em http://localhost:3000, com proxy para a API |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build de produção (com o mesmo proxy) |
| `npm test`, `test:unit`, `test:integration`, `test:architecture`, `test:watch` | Testes (Vitest) |
| `npm run test:e2e`, `test:e2e:ui`, `test:e2e:report` | Testes de ponta a ponta (Playwright), modo interativo e relatório |
| `npm run typecheck` / `npm run typecheck:e2e` | Verificação de tipos do painel / dos testes de ponta a ponta |
