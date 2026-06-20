#!/usr/bin/env bash
# Local Supabase Docker stack helpers for start_project_manager.sh (sourced, not executed directly).

: "${SUPABASE_DIR:=$PM_ROOT/docker/supabase}"
: "${SUPABASE_KONG_PORT:=54329}"
: "${SUPABASE_STUDIO_URL:=http://localhost:54329}"

supabase_read_env_value() {
  local key="$1"
  local env_file="$SUPABASE_DIR/.env"
  [[ -f "$env_file" ]] || return 1
  awk -F= -v key="$key" '
    $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
      value = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      if ((value ~ /^".*"$/) || (value ~ /^'\''.*'\''$/)) {
        value = substr(value, 2, length(value) - 2)
      }
      print value
      exit
    }
  ' "$env_file"
}

supabase_load_ports() {
  local kong_port public_url
  kong_port="$(supabase_read_env_value KONG_HTTP_PORT || true)"
  public_url="$(supabase_read_env_value SUPABASE_PUBLIC_URL || true)"
  if [[ -n "$kong_port" ]]; then
    SUPABASE_KONG_PORT="$kong_port"
  fi
  if [[ -n "$public_url" ]]; then
    SUPABASE_STUDIO_URL="$public_url"
  else
    SUPABASE_STUDIO_URL="http://localhost:${SUPABASE_KONG_PORT}"
  fi
}

supabase_ensure_env_file() {
  if [[ -f "$SUPABASE_DIR/.env" ]]; then
    return 0
  fi
  if [[ ! -f "$SUPABASE_DIR/.env.example" ]]; then
    error "Missing $SUPABASE_DIR/.env.example"
    return 1
  fi
  info "Creating docker/supabase/.env from .env.example…"
  cp "$SUPABASE_DIR/.env.example" "$SUPABASE_DIR/.env"
  success "Created docker/supabase/.env"
}

supabase_require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    error "Docker is required for the local Supabase stack but was not found on PATH."
    echo "Install Docker Desktop / OrbStack, then retry."
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    error "Docker daemon is not running. Start Docker Desktop / OrbStack, then retry."
    return 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    error "docker compose is required but not available."
    return 1
  fi
  return 0
}

supabase_sync_app_env() {
  if ! dep_discover_node; then
    warn "Node.js not available — skipping .env.local Supabase sync"
    return 0
  fi
  info "Syncing Supabase URL/anon key into .env.local…"
  if node "$PM_ROOT/scripts/sync-local-supabase-env.mjs"; then
    success "App env synced (.env.local)"
    return 0
  fi
  warn "Could not sync .env.local from docker/supabase/.env"
  return 1
}

supabase_compose() {
  supabase_load_ports
  (
    cd "$SUPABASE_DIR" || exit 1
    docker compose "$@"
  )
}

supabase_is_running() {
  supabase_load_ports
  is_port_listening "$SUPABASE_KONG_PORT"
}

supabase_wait_ready() {
  local label="${1:-Local Supabase stack}"
  supabase_load_ports

  if ! wait_for_port "$SUPABASE_KONG_PORT" "Supabase Kong API"; then
    return 1
  fi

  local attempt
  for attempt in {1..40}; do
    if supabase_compose exec -T db pg_isready -U postgres -h localhost >/dev/null 2>&1; then
      local auth_health
      auth_health="$(docker inspect supabase-auth --format '{{.State.Health.Status}}' 2>/dev/null || true)"
      if [[ "$auth_health" == "healthy" || -z "$auth_health" ]]; then
        success "$label is ready (API: $SUPABASE_STUDIO_URL)"
        return 0
      fi
    fi
    sleep 0.5
  done

  warn "$label started but health checks did not pass within 20 seconds."
  warn "Check logs: cd docker/supabase && docker compose logs db auth kong"
  return 1
}

supabase_print_dashboard_access() {
  local dashboard_user dashboard_pass
  dashboard_user="$(supabase_read_env_value DASHBOARD_USERNAME || echo supabase)"
  dashboard_pass="$(supabase_read_env_value DASHBOARD_PASSWORD || echo supabase-local-dev)"
  echo "  Studio login (HTTP Basic Auth — browser will prompt on first visit):"
  echo "    Username: ${dashboard_user}"
  echo "    Password: ${dashboard_pass}"
  echo "  If you only see JSON \"Unauthorized\", enter the credentials above when prompted,"
  echo "  or open: http://${dashboard_user}:<password>@localhost:${SUPABASE_KONG_PORT}/"
  echo "  (local dev only — do not share this URL)"
}

supabase_print_success() {
  local log_hint="$1"
  print_app_success "Local Supabase (Kong API / Studio)" "$SUPABASE_KONG_PORT" "$SUPABASE_STUDIO_URL" "$log_hint"
  supabase_print_dashboard_access
}

cmd_supabase() {
  header "Local Supabase — Docker Stack"
  local log_hint="$SUPABASE_DIR (docker compose logs)"
  local already_running=0

  supabase_load_ports

  if ! supabase_require_docker; then
    return 1
  fi

  if ! supabase_ensure_env_file; then
    return 1
  fi

  if [[ "$FORCE_RESTART" == "1" ]]; then
    info "Restarting local Supabase stack…"
    supabase_compose down >/dev/null 2>&1 || true
  elif supabase_is_running; then
    already_running=1
    success "Local Supabase already running — $SUPABASE_STUDIO_URL"
    supabase_sync_app_env || true
    supabase_wait_ready "Local Supabase stack" || true
    supabase_print_success "$log_hint"
    return 0
  fi

  info "Starting local Supabase stack (docker compose up -d)…"
  if ! supabase_compose up -d; then
    print_app_failure "Local Supabase stack" "docker compose up failed" "$log_hint"
    return 1
  fi

  if ! supabase_wait_ready "Local Supabase stack"; then
    print_app_failure "Local Supabase stack" "health checks did not pass" "$log_hint"
    return 1
  fi

  supabase_sync_app_env || true

  supabase_print_success "$log_hint"
  return 0
}

cmd_supabase_stop() {
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    return 0
  fi
  if [[ ! -f "$SUPABASE_DIR/docker-compose.yml" ]]; then
    return 0
  fi
  if ! supabase_is_running; then
    return 0
  fi
  info "Stopping local Supabase Docker stack…"
  if supabase_compose down >/dev/null 2>&1; then
    success "Local Supabase stack stopped"
  else
    warn "Could not stop local Supabase stack cleanly"
  fi
}

ensure_supabase_for_pm() {
  if [[ "${PROJECT_MANAGER_SKIP_SUPABASE:-0}" == "1" ]]; then
    info "Local Supabase autostart skipped by PROJECT_MANAGER_SKIP_SUPABASE=1"
    return 0
  fi
  cmd_supabase
}
