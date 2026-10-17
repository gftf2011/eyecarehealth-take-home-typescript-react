# syntax=docker/dockerfile:1
#
# Imagem única do backend; cada serviço do compose escolhe o processo pelo
# comando (API, outbox relay, gateway de tempo real, migrations, seed).
# Contexto do build: a raiz do repositório (para incluir seed/data.json);
# o filtro do contexto está em Dockerfile.dockerignore, ao lado deste arquivo.

ARG NODE_IMAGE=node:22-alpine

# 1) Dependências completas (o build precisa de typescript/tsup).
FROM ${NODE_IMAGE} AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# 2) Build: um bundle ESM por entrypoint em dist/.
FROM deps AS build
COPY backend/ ./
RUN npm run build

# 3) Só as dependências de produção (o bundle as mantém externas).
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# 4) Runtime enxuto, sem código-fonte nem ferramentas de build, como não-root.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    SEED_FILE=/app/seed/data.json
WORKDIR /app/backend
COPY --from=prod-deps --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --chown=node:node backend/package.json ./
COPY --chown=node:node seed/ /app/seed/
USER node
EXPOSE 3001 3002 3003
CMD ["node", "dist/server.js"]
