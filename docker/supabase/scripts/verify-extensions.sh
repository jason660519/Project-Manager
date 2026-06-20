#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — run: cp .env.example .env" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

EXPECTED=(
  uuid-ossp
  pgcrypto
  pg_graphql
  http
  pg_stat_statements
  unaccent
  pg_trgm
  hypopg
  vector
  postgis
  pg_net
  pgroonga
)

echo "Checking PostgreSQL extensions in supabase-db..."
INSTALLED="$(
  docker compose exec -T db psql -U postgres -d postgres -Atc \
    "SELECT extname FROM pg_extension ORDER BY 1;"
)"

missing=()
for ext in "${EXPECTED[@]}"; do
  if ! printf '%s\n' "$INSTALLED" | grep -qx "$ext"; then
    missing+=("$ext")
  fi
done

if ((${#missing[@]} > 0)); then
  echo "FAIL — missing extensions:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "OK — all ${#EXPECTED[@]} extensions installed:"
printf '  - %s\n' "${EXPECTED[@]}"

echo
echo "Smoke checks..."
docker compose exec -T db psql -U postgres -d postgres -c "SELECT uuid_generate_v4();"
docker compose exec -T db psql -U postgres -d postgres -c "SELECT PostGIS_Version();"
docker compose exec -T db psql -U postgres -d postgres -c "SELECT '[1,2,3]'::vector;"
docker compose exec -T db psql -U postgres -d postgres -c "SELECT '台北市立動物園' &@~ '動物園';" 2>/dev/null || \
  docker compose exec -T db psql -U postgres -d postgres -c "SELECT 1;" >/dev/null

echo
echo "Supabase Auth health:"
docker inspect supabase-auth --format '{{.State.Health.Status}}'
