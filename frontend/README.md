# FastMeals — Frontend

Painel administrativo da **FastMeals** em **React 19 + TypeScript** estrito. Mesma arquitetura do backend: um módulo por bounded context, Clean Architecture dentro de cada um, regras de negócio sem React e testes de arquitetura que impedem a estrutura de se degradar.

- **Vite 8**, **React 19**, **React Router 8**, **TanStack Query 5**, **Zod 4**, CSS Modules com design tokens (tema claro/escuro)
- Testes com **Vitest**, **Testing Library**, **MSW** (API simulada) e **ArchUnitTS**

> **Estado atual:**
> - **Identity**: login, sessão, renovação de token, rotas protegidas por sessão e permissão, logout.
> - **Ordering**: painel de pedidos (`/pedidos`, a página inicial) com filtros por status, período e ordenação guardados na URL, lista paginada, detalhe em modal com link próprio e botões de status contextuais (só as transições válidas; cancelar pede confirmação; despachar sem entregador fica bloqueado com o motivo; perfil `viewer` não vê ações).
>
> As telas de produtos, entregadores, atribuição, relatórios e a atualização em tempo real entram nos próximos passos.

## Início rápido

Com o backend no ar (`cd backend && npm run docker:up`):

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Login: `admin@fastmeals.com` / `Admin@123` (acesso total) ou `viewer@fastmeals.com` / `Viewer@123` (somente leitura).

O Vite encaminha `/api` para `http://localhost:3001` e `/realtime` para `ws://localhost:3002`. O painel e a API ficam na **mesma origem**: o cookie do refresh token (`httpOnly`, `SameSite=Strict`, `Path=/api/auth`) funciona sem CORS. Para apontar para outro backend, use `API_PROXY_TARGET` / `REALTIME_PROXY_TARGET` (proxy) ou `VITE_API_BASE_URL` (URL da API no navegador).

---

## Arquitetura

### Contextos e camadas

As pastas espelham os bounded contexts do backend (por enquanto, `identity` e `ordering`), mais o `shared-kernel` e a composição em `main/`:

```
src/
├── identity/            login, sessão, permissões
│   ├── domain/          Session, Email, Password, Role (matriz de permissões) — TypeScript puro
│   ├── application/     casos de uso (login, restaurar/renovar sessão, logout), ports, DTOs
│   ├── infra/           gateway HTTP, store da sessão, trava entre abas, agendador de renovação
│   ├── presentation/    componentes, páginas, hooks, rotas (React)
│   └── main/            composition root do contexto
├── ordering/            painel de pedidos: OrderStatus (máquina de estados), Order, filtros, casos de uso, telas
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

A validação em tempo real usa **as mesmas regras do caso de uso** (Value Objects): `loginInputErrors(values)` roda a cada digitação, e o erro de um campo aparece depois que ele é visitado ou numa tentativa de envio. Erros por campo vindos da API aparecem no próprio campo. Acessibilidade: `label` associado, `aria-invalid`, `aria-describedby` com a mensagem, foco no primeiro campo inválido e `role="alert"` nos erros.

---

## Como testar

```bash
npm test                   # todas as suítes
npm run test:unit          # domínio, casos de uso, infra e componentes
npm run test:integration   # telas inteiras com a API simulada (MSW)
npm run test:architecture  # regras de arquitetura (ArchUnitTS)
npm run typecheck          # tsc --noEmit (strict)
```

| Sufixo | O que cobre |
|---|---|
| `*.unit.spec.ts(x)` | Value Objects, casos de uso com fakes, cliente HTTP (mapeamento de erros, renovação no `401`), provider de token (renovação única), trava entre abas, agendador (fake timers), componentes (renderização e interação) |
| `*.integration.spec.tsx` | O painel inteiro, montado como em `main.tsx`, com roteador em memória e a API atendida pelo **MSW**: login válido e inválido, retorno à página pedida, sessão restaurada no reload, sessão revogada → login com aviso, logout |
| `*.architecture.spec.ts` | Camadas, isolamento entre contextos, domínio sem bibliotecas, aplicação sem React/HTTP/APIs do navegador, segurança (sem storage, sem HTML cru, sem `document.cookie`), convenções de nomes e pastas |

Nenhum teste chama a rede: o MSW recusa qualquer requisição sem handler.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em http://localhost:3000, com proxy para a API |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build de produção (com o mesmo proxy) |
| `npm test`, `test:unit`, `test:integration`, `test:architecture`, `test:watch` | Testes |
| `npm run typecheck` | Verificação de tipos |
