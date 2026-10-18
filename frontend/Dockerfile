# syntax=docker/dockerfile:1
#
# Painel FastMeals: build estático (Vite) servido por nginx sem root, que
# também faz o proxy de /api e /realtime para o backend na mesma origem
# (o cookie httpOnly do refresh token funciona sem CORS).

ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30-alpine

# 1) Dependências (o build precisa de typescript e vite).
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# 2) Verificação de tipos e build de produção em dist/.
FROM deps AS build
COPY . .
RUN npm run typecheck && npm run build

# 3) Runtime: só o nginx e os arquivos estáticos.
FROM ${NGINX_IMAGE} AS runtime
# Upstreams do proxy (nomes dos serviços no docker-compose). O entrypoint da
# imagem exporta o DNS do contêiner em NGINX_LOCAL_RESOLVERS para o template.
ENV API_UPSTREAM=api:3001 \
    REALTIME_UPSTREAM=realtime:3002 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
