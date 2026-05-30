#!/usr/bin/env bash
# Auxiliary page helpers for start_project_manager.sh (sourced, not executed directly).

launcher_profile_query() {
  local query="$1"
  dep_discover_node >/dev/null 2>&1 || return 1
  node "$PM_ROOT/scripts/resolve-launcher-profile.mjs" \
    --profile "${PM_LAUNCHER_PROFILE:-dev}" \
    --root "$PM_ROOT" \
    --query "$query" 2>/dev/null
}

aux_page_port_from_url() {
  local url="$1"
  if [[ "$url" =~ ^https?://[^/:]+:([0-9]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  if is_local_browser_url "$url"; then
    case "$url" in
      *:9119*|*:9119/*) printf '9119\n'; return 0 ;;
      *:18790*|*:18790/*) printf '18790\n'; return 0 ;;
      *:43187*|*:43187/*) printf '43187\n'; return 0 ;;
    esac
  fi
  return 1
}

aux_page_is_reachable() {
  local url="$1"
  local status
  status="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null || true)"
  [[ "$status" =~ ^[23] ]]
}

aux_page_should_open() {
  local open_when="$1"
  local url="$2"

  case "$open_when" in
    never) return 1 ;;
    always) return 0 ;;
    running)
      local port
      port="$(aux_page_port_from_url "$url" || true)"
      if [[ -n "$port" ]] && is_port_listening "$port"; then
        return 0
      fi
      return 1
      ;;
    reachable|*)
      aux_page_is_reachable "$url"
      ;;
  esac
}

open_auxiliary_app_pages() {
  header "Auxiliary Software Pages"

  if [[ "${PROJECT_MANAGER_SKIP_AUX_OPEN:-0}" == "1" ]]; then
    warn "Auxiliary page auto-open skipped by PROJECT_MANAGER_SKIP_AUX_OPEN=1"
    return 0
  fi

  if ! dep_discover_node; then
    warn "Node.js not available — skipping profile-driven auxiliary pages"
    return 0
  fi

  local opened=0
  local skipped=0
  while IFS=$'\t' read -r page_id label url open_when scope; do
    [[ -n "$url" ]] || continue
    if aux_page_should_open "$open_when" "$url"; then
      info "Opening $label: $(safe_url_for_display "$url")"
      open_local_url "$url"
      opened=$((opened + 1))
    else
      warn "Skipped $label ($(safe_url_for_display "$url")) — not $open_when"
      skipped=$((skipped + 1))
    fi
  done < <(node "$PM_ROOT/scripts/resolve-launcher-profile.mjs" \
    --profile "${PM_LAUNCHER_PROFILE:-dev}" \
    --root "$PM_ROOT" \
    --aux-tsv 2>/dev/null || true)

  if (( opened == 0 && skipped == 0 )); then
    info "No auxiliary pages configured in launcher profile"
  else
    success "Auxiliary pages: opened $opened, skipped $skipped"
  fi
}

wait_for_pm_ready() {
  local label="${1:-Project Manager web app}"
  local wait_seconds
  wait_seconds="$(launcher_profile_query pm.startupWaitSeconds || echo 120)"
  local health_path
  health_path="$(launcher_profile_query pm.healthPath || echo /project-progress-dashboard)"
  local url="http://127.0.0.1:${DEV_PORT}${health_path}"
  local attempts=$((wait_seconds * 4))

  for ((i = 1; i <= attempts; i++)); do
    if is_port_listening "$DEV_PORT" && is_dev_server_healthy; then
      success "$label is ready on port $DEV_PORT"
      return 0
    fi
    if is_port_listening "$DEV_PORT"; then
      local status
      status="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null || true)"
      if [[ "$status" == "200" ]]; then
        success "$label is ready on port $DEV_PORT"
        return 0
      fi
    fi
    sleep 0.25
  done

  warn "$label did not become ready within ${wait_seconds}s. Check .project-manager/dev-logs/"
  return 1
}
