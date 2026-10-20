#!/usr/bin/env bash
# Teste de carga com o k6 numa stack Docker isolada (projeto `fastmeals-load`,
# portas próprias e banco novo com o seed): os dados de desenvolvimento não
# são tocados.
#
#   npm run test:load                         25.000 pedidos + 1 min de carga mista
#   ORDERS=50000 DURATION=3m RATE=2 npm run test:load
#   KEEP_STACK=1 npm run test:load            mantém a stack no fim (depurar)
#   SKIP_SEED=1 KEEP_STACK=1 npm run test:load   repete a carga sobre o volume já criado
#
# O k6 roda num contêiner (imagem fixada) na rede da stack e entra pelo nginx,
# como o navegador. Os resumos ficam em backend/load-tests/results/.
set -euo pipefail

LOAD_TESTS="$(cd "$(dirname "$0")" && pwd)"
# O docker-compose.yml é o da raiz do repositório (único para o projeto todo).
ROOT="$(cd "$LOAD_TESTS/../.." && pwd)"
PROJECT=fastmeals-load
K6_IMAGE=grafana/k6:1.3.0
RESULTS="$LOAD_TESTS/results"

export FRONTEND_PORT=3200 API_PORT=3201 REALTIME_PORT=3202
export POSTGRES_PORT=55433 REDIS_PORT=56380 FLOCI_PORT=45667
# Toda a carga sai de um único IP: o limite de 100/min por IP derrubaria o teste.
# O middleware continua ativo (o custo dele entra na medição); só o teto sobe.
export RATE_LIMIT_MAX=10000000
# Sem o otel-lgtm nesta stack: os processos nem tentam exportar.
export OTEL_SDK_DISABLED=true
# Floci em memória: em disco, o emulador publica ~70 msg/s e vira o gargalo.
export FLOCI_STORAGE_MODE=memory
# O k6 entra uma vez e reaproveita o token: com 15 min, uma rodada longa
# passaria a receber só 401.
export JWT_EXPIRES_IN=4h

compose() { docker compose -f "$ROOT/docker-compose.yml" -p "$PROJECT" "$@"; }
sql() { compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$0"' "$1"; }

# Os eventos do seed ainda saindo pelo SNS/SQS fazem o Floci (o emulador da
# AWS, que em produção não estaria nesta máquina) disputar CPU com a API e o
# banco durante a medição: espera o outbox esvaziar antes de medir.
wait_for_outbox() {
  local pending
  while true; do
    pending=$(sql "SELECT count(*) FROM outbox_events WHERE published_at IS NULL AND dead_lettered_at IS NULL")
    [[ "$pending" == "0" ]] && return
    echo "  outbox: $pending eventos a publicar…"
    sleep 10
  done
}

k6() {
  docker run --rm -i \
    --network "${PROJECT}_default" \
    -v "$LOAD_TESTS:/scripts:ro" \
    -v "$RESULTS:/results" \
    "$K6_IMAGE" run -e BASE_URL=http://frontend:8080 "$@"
}

cleanup() {
  if [[ "${KEEP_STACK:-}" == "1" ]]; then
    echo "Stack mantida: http://localhost:$FRONTEND_PORT (derrube com: docker compose -p $PROJECT down --volumes)"
  else
    compose down --volumes --remove-orphans >/dev/null 2>&1
  fi
}
trap cleanup EXIT

mkdir -p "$RESULTS"
if [[ "${SKIP_SEED:-}" != "1" ]]; then
  echo "Subindo a stack de carga ($PROJECT)…"
  compose down --volumes --remove-orphans >/dev/null 2>&1
  compose up --build --detach --wait frontend
  echo "Criando ${ORDERS:-25000} pedidos pela API…"
  k6 -e "ORDERS=${ORDERS:-25000}" --summary-export /results/seed-orders.json /scripts/seed-orders.js
fi

echo "Esperando o outbox esvaziar…"
wait_for_outbox

echo "Carga mista nos principais endpoints (${DURATION:-1m}, taxa x${RATE:-1})…"
k6 -e "DURATION=${DURATION:-1m}" -e "RATE=${RATE:-1}" --summary-export /results/endpoints.json /scripts/endpoints.js
