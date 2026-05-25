#!/usr/bin/env bash
# Project Manager — one-click install / update / start
# Usage:
#   ./start_project_manager.sh           show interactive menu
#   ./start_project_manager.sh start     start the Tauri desktop app
#   ./start_project_manager.sh web       start Next.js web server only (no Tauri)
#   ./start_project_manager.sh all       start PM + Hermes + OpenClaw and open all auxiliary pages
#   ./start_project_manager.sh core      start PM + Hermes + OpenClaw only (essential pages)
#   ./start_project_manager.sh aux       open auxiliary software pages only
#   ./start_project_manager.sh install   force full install check
#   ./start_project_manager.sh update    update npm deps + rebuild Rust
#   ./start_project_manager.sh stop      stop all services
#   ./start_project_manager.sh hermes    start Hermes Agent dashboard only
#   ./start_project_manager.sh openclaw  start OpenClaw gateway and open dashboard
#
# Flags (any command):
#   --open, --force-open   open browser even when the service is already running
#   --restart              stop the target service port before starting (hermes/openclaw/all)

set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_NODE=18
DEV_PORT=43187
HERMES_PORT=9119
OPENCLAW_PORT=18790
OLLAMA_URL="${PROJECT_MANAGER_OLLAMA_URL:-http://192.168.1.6:11434/}"
OPENWEBUI_URL="${PROJECT_MANAGER_OPENWEBUI_URL:-http://192.168.1.6:38457/}"
COMFYUI_URL="${PROJECT_MANAGER_COMFYUI_URL:-http://192.168.1.6:30000/}"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
BLUE="\033[34m"
RESET="\033[0m"

FORCE_OPEN=0
FORCE_RESTART=0
OPENED_URLS_SESSION=$'\n'

# ── Helpers ───────────────────────────────────────────────────────────────────

info()    { echo -e "${CYAN}▶ $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}" >&2; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

configure_tauri_dev_secret_backend() {
  if [[ -z "${PM_DEV_PLAINTEXT_SECRETS+x}" ]]; then
    export PM_DEV_PLAINTEXT_SECRETS=1
    success "Dev secret backend: ~/.project-manager/dev-secrets.json (Keychain prompts disabled)"
    return 0
  fi

  case "$(printf '%s' "$PM_DEV_PLAINTEXT_SECRETS" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes)
      success "Dev secret backend: ~/.project-manager/dev-secrets.json (Keychain prompts disabled)"
      ;;
    0|false|no)
      warn "PM_DEV_PLAINTEXT_SECRETS=$PM_DEV_PLAINTEXT_SECRETS forces macOS Keychain during dev; prompts may appear."
      ;;
    *)
      warn "PM_DEV_PLAINTEXT_SECRETS=$PM_DEV_PLAINTEXT_SECRETS is not a standard value; Rust will decide the secret backend."
      ;;
  esac
}

require_cmd() {
  if ! command -v "$1" &>/dev/null; then
    return 1
  fi
}

is_next_process() {
  local pid="$1"
  local cmdline
  cmdline="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$cmdline" == *"next-server"* || "$cmdline" == *"next dev"* ]]
}

kill_pid_if_running() {
  local pid="$1"
  kill "$pid" 2>/dev/null || true
  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  done
  kill -9 "$pid" 2>/dev/null || true
}

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t &>/dev/null
}

is_dev_server_healthy() {
  local url="http://127.0.0.1:${DEV_PORT}/project-progress-dashboard"
  local status
  status="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || true)"
  [[ "$status" == "200" ]]
}

wait_for_port() {
  local port="$1"
  local label="$2"
  for _ in {1..40}; do
    if is_port_listening "$port"; then
      success "$label is listening on port $port"
      return 0
    fi
    sleep 0.25
  done
  warn "$label did not report a listening port within 10 seconds. Check logs under .project-manager/dev-logs/."
  return 1
}

should_force_open_browser() {
  [[ "${PROJECT_MANAGER_FORCE_OPEN:-0}" == "1" || "$FORCE_OPEN" == "1" ]]
}

session_has_url_opened() {
  local normalized_url
  normalized_url="$(normalize_browser_url "$1")"
  [[ "$OPENED_URLS_SESSION" == *$'\n'"$normalized_url"$'\n'* ]]
}

remember_session_opened_url() {
  local normalized_url
  normalized_url="$(normalize_browser_url "$1")"
  if [[ "$OPENED_URLS_SESSION" != *$'\n'"$normalized_url"$'\n'* ]]; then
    OPENED_URLS_SESSION+="${normalized_url}"$'\n'
  fi
}

open_local_url() {
  local url="$1"
  local target_url
  target_url="$(normalize_browser_url "$url")"

  if [[ "${PROJECT_MANAGER_NO_OPEN:-0}" == "1" ]]; then
    success "Browser auto-open skipped: $(safe_url_for_display "$url")"
    return 0
  fi

  if ! should_force_open_browser && session_has_url_opened "$target_url"; then
    success "Browser tab already handled in this run: $(safe_url_for_display "$url")"
    return 0
  fi

  if ! should_force_open_browser && browser_has_url_open "$url"; then
    remember_session_opened_url "$target_url"
    success "Browser tab already open: $(safe_url_for_display "$url")"
    return 0
  fi

  if [[ "$PLATFORM" == "macOS" ]]; then
    if open "$url" >/dev/null 2>&1; then
      remember_session_opened_url "$target_url"
    else
      warn "Could not open browser automatically: $url"
    fi
  else
    if command -v xdg-open >/dev/null 2>&1; then
      if xdg-open "$url" >/dev/null 2>&1; then
        remember_session_opened_url "$target_url"
      else
        warn "Could not open browser automatically: $url"
      fi
    else
      warn "Open this URL manually: $url"
    fi
  fi
}

# Open the browser even when the service was already running; open_local_url
# handles duplicate-tab prevention when the URL is already open.
maybe_open_local_url() {
  local url="$1"
  local service_was_running="${2:-0}"

  if [[ "${PROJECT_MANAGER_NO_OPEN:-0}" == "1" ]]; then
    success "Browser auto-open skipped: $(safe_url_for_display "$url")"
    return 0
  fi

  if [[ "$service_was_running" == "1" ]]; then
    info "Service already running; checking browser tab for $(safe_url_for_display "$url")"
  fi

  open_local_url "$url"
}

stop_listeners_on_port() {
  local port="$1"
  local label="$2"
  local pids
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  warn "Stopping $label on port ${port}…"
  local pid
  for pid in $pids; do
    kill_pid_if_running "$pid"
  done
  success "Port ${port} cleared ($label)"
}

safe_url_for_display() {
  local url="$1"
  printf '%s\n' "${url%%#token=*}"
}

normalize_browser_url() {
  local url="$1"
  url="${url%%#*}"
  url="${url%%\?*}"
  while [[ "$url" == */ && ${#url} -gt 8 ]]; do
    url="${url%/}"
  done
  printf '%s\n' "$url"
}

canonicalize_browser_host() {
  local host="$1"
  host="${host#[}"
  host="${host%]}"
  host="$(printf '%s' "$host" | tr '[:upper:]' '[:lower:]')"

  case "$host" in
    localhost|127.0.0.1|::1)
      printf 'localhost\n'
      ;;
    *)
      printf '%s\n' "$host"
      ;;
  esac
}

is_local_browser_url() {
  local url
  url="$(normalize_browser_url "$1")"

  if [[ "$url" =~ ^([a-zA-Z][a-zA-Z0-9+.-]*)://([^/]+) ]]; then
    local authority="${BASH_REMATCH[2]}"
    local host=""

    if [[ "$authority" == \[*\]* ]]; then
      host="${authority%%]*}"
      host="${host#[}"
    else
      if [[ "$authority" == *:* ]]; then
        host="${authority%%:*}"
      else
        host="$authority"
      fi
    fi

    case "$(canonicalize_browser_host "$host")" in
      localhost)
        return 0
        ;;
    esac
  fi

  return 1
}

url_origin_key() {
  local url
  url="$(normalize_browser_url "$1")"

  if [[ "$url" =~ ^([a-zA-Z][a-zA-Z0-9+.-]*)://([^/]+) ]]; then
    local scheme="${BASH_REMATCH[1]}"
    local authority="${BASH_REMATCH[2]}"
    local host=""
    local port=""

    if [[ "$authority" == \[*\]* ]]; then
      host="${authority%%]*}"
      host="${host#[}"
      local remainder="${authority#*]}"
      if [[ "$remainder" == :* ]]; then
        port="${remainder#:}"
      fi
    else
      if [[ "$authority" == *:* ]]; then
        host="${authority%%:*}"
        port="${authority##*:}"
      else
        host="$authority"
      fi
    fi

    scheme="$(printf '%s' "$scheme" | tr '[:upper:]' '[:lower:]')"
    host="$(canonicalize_browser_host "$host")"

    if [[ -z "$port" ]]; then
      case "$scheme" in
        http) port="80" ;;
        https) port="443" ;;
      esac
    fi

    printf '%s://%s:%s\n' "$scheme" "$host" "$port"
    return 0
  fi

  printf '%s\n' "$url"
}

browser_has_url_open() {
  local url="$1"

  if [[ "${PROJECT_MANAGER_BROWSER_DEDUP:-1}" == "0" ]]; then
    return 1
  fi
  if [[ "$PLATFORM" != "macOS" ]] || ! command -v osascript >/dev/null 2>&1; then
    return 1
  fi

  local target_url
  target_url="$(normalize_browser_url "$url")"
  local target_origin
  target_origin="$(url_origin_key "$url")"
  local local_origin_dedup="${PROJECT_MANAGER_LOCAL_ORIGIN_DEDUP:-1}"
  local target_is_local=0
  if is_local_browser_url "$url"; then
    target_is_local=1
  fi

  local result
  result="$(osascript - 2>/dev/null <<'APPLESCRIPT' || true
on appendTabsForApp(appName, existingText)
  set outputText to existingText
  tell application appName
    repeat with browserWindow in windows
      repeat with browserTab in tabs of browserWindow
        try
          set tabUrl to URL of browserTab as text
          if tabUrl is not "" then set outputText to outputText & tabUrl & linefeed
        end try
      end repeat
    end repeat
  end tell
  return outputText
end appendTabsForApp

on run
  set outputText to ""
  set browserNames to {"Google Chrome", "Microsoft Edge", "Brave Browser", "Safari"}
  tell application "System Events"
    set runningNames to name of application processes
  end tell

  repeat with browserName in browserNames
    set appName to browserName as text
    if runningNames contains appName then
      try
        set outputText to my appendTabsForApp(appName, outputText)
      end try
    end if
  end repeat

  return outputText
end run
APPLESCRIPT
)"

  local open_url
  while IFS= read -r open_url; do
    [[ -n "$open_url" ]] || continue
    local normalized_open
    normalized_open="$(normalize_browser_url "$open_url")"
    if [[ "$normalized_open" == "$target_url" ]]; then
      return 0
    fi

    # For local services, treat same origin as duplicate regardless of path.
    if [[ "$local_origin_dedup" == "1" && "$target_is_local" == "1" ]] && is_local_browser_url "$open_url"; then
      local open_origin
      open_origin="$(url_origin_key "$open_url")"
      if [[ "$open_origin" == "$target_origin" ]]; then
        return 0
      fi
    fi
  done <<< "$result"

  return 1
}

start_background_service() {
  local name="$1"
  local log_file="$2"
  shift 2

  mkdir -p "$(dirname "$log_file")"
  cd "$SCRIPT_DIR"
  info "Starting $name in background. Log: $log_file"
  nohup "$@" >> "$log_file" 2>&1 &
  local pid="$!"
  echo "$pid" > "${log_file}.pid"
  success "$name started (PID $pid)"
}

running_pid_from_file() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(tr -dc '0-9' < "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  if kill -0 "$pid" 2>/dev/null; then
    printf '%s\n' "$pid"
    return 0
  fi
  return 1
}

print_app_success() {
  local name="$1"
  local port="$2"
  local url="$3"
  local log_file="${4:-}"
  success "$name opened successfully"
  echo "  Port: $port"
  echo "  URL:  $url"
  if [[ -n "$log_file" ]]; then
    echo "  Log:  $log_file"
  fi
}

print_app_failure() {
  local name="$1"
  local reason="$2"
  local log_file="${3:-}"
  error "$name failed to open: $reason"
  if [[ -n "$log_file" ]]; then
    echo "  Log: $log_file"
  fi
}

open_auxiliary_app_pages() {
  header "Auxiliary Software Pages"

  if [[ "${PROJECT_MANAGER_SKIP_AUX_OPEN:-0}" == "1" ]]; then
    warn "Auxiliary page auto-open skipped by PROJECT_MANAGER_SKIP_AUX_OPEN=1"
    return 0
  fi

  local pages=(
    "Hermes Agent Dashboard|http://127.0.0.1:${HERMES_PORT}"
    "OpenClaw Dashboard|http://127.0.0.1:${OPENCLAW_PORT}/"
    "Ollama API|$OLLAMA_URL"
    "Open WebUI|$OPENWEBUI_URL"
    "ComfyUI|$COMFYUI_URL"
  )

  local page name url
  for page in "${pages[@]}"; do
    name="${page%%|*}"
    url="${page#*|}"
    info "Opening $name: $(safe_url_for_display "$url")"
    open_local_url "$url"
  done

  success "Auxiliary software pages handled"
}

read_openclaw_gateway_token() {
  local env_file="$SCRIPT_DIR/.project-manager/openclaw/state/.env"
  if [[ ! -f "$env_file" ]]; then
    return 1
  fi
  awk -F= '/^OPENCLAW_GATEWAY_TOKEN=/{print substr($0, index($0, "=") + 1); exit}' "$env_file"
}

get_openclaw_dashboard_url() {
  local base_url="http://127.0.0.1:${OPENCLAW_PORT}/"
  local output
  output="$(bash "$SCRIPT_DIR/scripts/openclaw.sh" dashboard --no-open 2>&1)" || {
    printf '%s\n' "$output" >&2
    return 1
  }

  if [[ "$PLATFORM" == "macOS" ]] && command -v pbpaste >/dev/null 2>&1; then
    local clipboard_url
    clipboard_url="$(pbpaste 2>/dev/null || true)"
    if [[ "$clipboard_url" == http://127.0.0.1:${OPENCLAW_PORT}* || "$clipboard_url" == http://localhost:${OPENCLAW_PORT}* ]]; then
      printf '%s\n' "$clipboard_url"
      return 0
    fi
  fi

  printf '%s\n' "$base_url"
}

approve_openclaw_pending_pairings_once() {
  local pending_file="$SCRIPT_DIR/.project-manager/openclaw/state/devices/pending.json"
  local paired_file="$SCRIPT_DIR/.project-manager/openclaw/state/devices/paired.json"
  [[ -f "$pending_file" ]] || return 0

  node - "$pending_file" "$paired_file" <<'NODE'
const fs = require("fs");
const crypto = require("crypto");

const pendingPath = process.argv[2];
const pairedPath = process.argv[3];
const allowedClients = new Set(["openclaw-control-ui", "cli"]);

function readJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function uniq(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function token() {
  return crypto.randomBytes(32).toString("base64url");
}

const pending = readJson(pendingPath, {});
const paired = readJson(pairedPath, {});
const now = Date.now();
const approved = [];

for (const [requestId, request] of Object.entries(pending)) {
  if (!request || typeof request !== "object") continue;
  if (!allowedClients.has(request.clientId)) continue;
  const deviceId = typeof request.deviceId === "string" ? request.deviceId : "";
  if (!deviceId) continue;

  const existing = paired[deviceId] && typeof paired[deviceId] === "object" ? paired[deviceId] : {};
  const existingTokens =
    existing.tokens && typeof existing.tokens === "object" && !Array.isArray(existing.tokens)
      ? existing.tokens
      : {};
  const existingOperator =
    existingTokens.operator && typeof existingTokens.operator === "object"
      ? existingTokens.operator
      : null;

  const roles = uniq([
    ...(Array.isArray(existing.roles) ? existing.roles : []),
    existing.role,
    ...(Array.isArray(request.roles) ? request.roles : []),
    request.role,
  ]);
  const approvedScopes = uniq([
    ...(Array.isArray(existing.approvedScopes) ? existing.approvedScopes : []),
    ...(Array.isArray(existing.scopes) ? existing.scopes : []),
    ...(Array.isArray(request.scopes) ? request.scopes : []),
  ]);
  const operatorTokenScopes = approvedScopes.includes("operator.admin")
    ? uniq(["operator.admin", "operator.pairing", "operator.read", "operator.write"])
    : approvedScopes.filter((scope) => scope.startsWith("operator."));

  paired[deviceId] = {
    ...existing,
    deviceId,
    publicKey: request.publicKey,
    platform: request.platform,
    clientId: request.clientId,
    clientMode: request.clientMode,
    role: request.role || existing.role || "operator",
    roles,
    scopes: approvedScopes,
    approvedScopes,
    tokens: {
      ...existingTokens,
      operator: {
        token: existingOperator?.token || token(),
        role: "operator",
        scopes: operatorTokenScopes,
        createdAtMs: existingOperator?.createdAtMs || now,
        rotatedAtMs: existingOperator ? now : undefined,
        revokedAtMs: undefined,
        lastUsedAtMs: existingOperator?.lastUsedAtMs,
      },
    },
    createdAtMs: existing.createdAtMs || now,
    approvedAtMs: now,
  };

  delete pending[requestId];
  approved.push(`${request.clientId}:${requestId}`);
}

if (approved.length > 0) {
  fs.mkdirSync(require("path").dirname(pairedPath), { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2) + "\n");
  fs.writeFileSync(pairedPath, JSON.stringify(paired, null, 2) + "\n");
  try { fs.chmodSync(pendingPath, 0o600); } catch {}
  try { fs.chmodSync(pairedPath, 0o600); } catch {}
}

console.log(approved.length);
NODE
}

approve_openclaw_pending_pairings() {
  local total=0
  local count
  for _ in {1..24}; do
    count="$(approve_openclaw_pending_pairings_once 2>/dev/null || printf '0')"
    if [[ "$count" =~ ^[0-9]+$ ]] && (( count > 0 )); then
      total=$((total + count))
    fi
    sleep 0.5
  done
  printf '%s\n' "$total"
}

ensure_dev_port_available() {
  local pids=()
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(lsof -nP -iTCP:"$DEV_PORT" -sTCP:LISTEN -t 2>/dev/null || true)

  if (( ${#pids[@]} == 0 )); then
    return 0
  fi

  local force_kill="${PROJECT_MANAGER_FORCE_KILL_PORT:-0}"
  if [[ "$FORCE_RESTART" == "1" ]]; then
    force_kill="1"
  fi

  local all_next=1
  local pid
  for pid in "${pids[@]}"; do
    if ! is_next_process "$pid"; then
      all_next=0
      break
    fi
  done

  if [[ "$all_next" == "1" && "$force_kill" != "1" ]]; then
    if is_dev_server_healthy; then
      success "Reusing healthy Next.js dev server on port $DEV_PORT (PID ${pids[0]})"
      return 0
    fi
    warn "Next.js dev server on port $DEV_PORT is listening but not healthy. Restarting it…"
    force_kill="1"
  fi

  warn "Port $DEV_PORT is currently in use. Resolving conflict…"

  for pid in "${pids[@]}"; do
    local cmdline
    cmdline="$(ps -p "$pid" -o command= 2>/dev/null || true)"

    if is_next_process "$pid" || [[ "$force_kill" == "1" ]]; then
      warn "Stopping process on port $DEV_PORT (PID $pid): ${cmdline:-unknown}"
      kill_pid_if_running "$pid"
      continue
    fi

    error "Port $DEV_PORT is used by a non-Next process (PID $pid): ${cmdline:-unknown}"
    echo ""
    echo "To proceed, either stop that process or run with:"
    echo "  PROJECT_MANAGER_FORCE_KILL_PORT=1 ./start_project_manager.sh start"
    exit 1
  done

  if lsof -nP -iTCP:"$DEV_PORT" -sTCP:LISTEN -t &>/dev/null; then
    error "Port $DEV_PORT is still occupied after cleanup. Please retry."
    exit 1
  fi

  success "Port $DEV_PORT is ready"
}

# ── OS detection ──────────────────────────────────────────────────────────────

OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM="macOS" ;;
  Linux)  PLATFORM="Linux" ;;
  *)
    error "Unsupported OS: $OS. Only macOS and Linux are supported."
    exit 1
    ;;
esac

# ── Prerequisite checks ───────────────────────────────────────────────────────

check_xcode_clt() {
  if [[ "$PLATFORM" != "macOS" ]]; then return 0; fi
  if ! xcode-select -p &>/dev/null; then
    warn "Xcode Command Line Tools not found. Installing…"
    xcode-select --install
    echo "Please re-run this script after the Xcode CLT installation completes."
    exit 0
  fi
  success "Xcode CLT found"
}

check_homebrew() {
  if [[ "$PLATFORM" != "macOS" ]]; then return 0; fi
  if ! require_cmd brew; then
    warn "Homebrew not found. Installing…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add brew to PATH for Apple Silicon
    if [[ -f /opt/homebrew/bin/brew ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
  fi
  success "Homebrew found: $(brew --version | head -1)"
}

check_node() {
  if require_cmd node; then
    local version
    version=$(node --version | sed 's/v//' | cut -d. -f1)
    if (( version >= MIN_NODE )); then
      success "Node.js found: $(node --version)"
      return 0
    fi
    warn "Node.js $(node --version) is too old (need v${MIN_NODE}+). Upgrading…"
  else
    warn "Node.js not found. Installing…"
  fi

  if [[ "$PLATFORM" == "macOS" ]]; then
    brew install node
  else
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  success "Node.js installed: $(node --version)"
}

check_rust() {
  if require_cmd rustc && require_cmd cargo; then
    success "Rust found: $(rustc --version)"
    return 0
  fi

  warn "Rust not found. Installing via rustup…"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  # Source cargo env for the current shell
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
  success "Rust installed: $(rustc --version)"
}

check_linux_deps() {
  if [[ "$PLATFORM" != "Linux" ]]; then return 0; fi
  info "Checking Linux Tauri system dependencies…"
  local pkgs=(
    libwebkit2gtk-4.1-dev
    build-essential
    curl
    wget
    file
    libssl-dev
    libayatana-appindicator3-dev
    librsvg2-dev
  )
  local missing=()
  for pkg in "${pkgs[@]}"; do
    if ! dpkg -s "$pkg" &>/dev/null; then
      missing+=("$pkg")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    warn "Missing packages: ${missing[*]}. Installing…"
    sudo apt-get update -q
    sudo apt-get install -y "${missing[@]}"
  fi
  success "Linux system dependencies OK"
}

# ── npm helpers ───────────────────────────────────────────────────────────────

npm_install() {
  info "Installing npm dependencies…"
  cd "$SCRIPT_DIR"
  npm install --prefer-offline --no-audit --no-fund 2>&1 | tail -3
  success "npm dependencies ready"
}

npm_update() {
  info "Updating npm dependencies…"
  cd "$SCRIPT_DIR"
  npm install --no-audit --no-fund 2>&1 | tail -3
  success "npm dependencies updated"
}

# ── Rust build check ──────────────────────────────────────────────────────────

rust_check() {
  info "Checking Rust build…"
  cd "$SCRIPT_DIR"
  # Ensure cargo env is available
  if [[ -f "$HOME/.cargo/env" ]]; then
    # shellcheck source=/dev/null
    source "$HOME/.cargo/env"
  fi
  cargo build --manifest-path src-tauri/Cargo.toml --quiet 2>&1
  success "Rust build OK"
}

# ── State file: track whether full install has run ───────────────────────────

STATE_FILE="$SCRIPT_DIR/.project-manager-installed"

mark_installed() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE_FILE"
}

is_installed() {
  [[ -f "$STATE_FILE" ]] && [[ -d "$SCRIPT_DIR/node_modules" ]]
}

# ── Auto-generate .project-manager.json ─────────────────────────────────────────────

auto_generate_config() {
  local config_file="$SCRIPT_DIR/.project-manager.json"

  if [[ -f "$config_file" ]]; then
    success ".project-manager.json already exists"
    return 0
  fi

  info "Generating .project-manager.json from project structure…"

  # Infer project name from package.json or directory name
  local project_name
  if [[ -f "$SCRIPT_DIR/package.json" ]] && require_cmd node; then
    project_name=$(node -e "try{console.log(require('./package.json').name||'')}catch{console.log('')}" 2>/dev/null)
  fi
  project_name="${project_name:-$(basename "$SCRIPT_DIR")}"

  # Detect default IDE from folder markers
  local default_ide="Cursor"
  local default_cmd="cursor"
  if [[ -d "$SCRIPT_DIR/.trae" ]]; then
    default_ide="Trae"; default_cmd="trae"
  elif [[ -d "$SCRIPT_DIR/.vscode" ]]; then
    default_ide="VSCode"; default_cmd="code"
  elif [[ -d "$SCRIPT_DIR/.cursor" ]]; then
    default_ide="Cursor"; default_cmd="cursor"
  fi

  # Build IDE adapters array
  local ide_adapters="{ \"id\": \"$default_ide\", \"name\": \"$default_ide\", \"type\": \"ide\", \"command\": \"$default_cmd\" }"

  # Detect agent CLIs
  local agent_adapters=""
  if [[ -d "$SCRIPT_DIR/.claude" ]] || command -v claude &>/dev/null; then
    agent_adapters='{ "id": "claude-code", "name": "Claude Code", "type": "agent", "command": "claude", "argsTemplate": ["--cwd", "{root}", "{prompt}"] }'
  fi

  # Write the config
  cat > "$config_file" << PROJECT_MANAGER_JSON
{
  "schemaVersion": 1,
  "project": {
    "name": "$project_name",
    "root": "$SCRIPT_DIR",
    "defaultIDE": "$default_ide"
  },
  "features": [],
  "adapters": {
    "ides": [
      $ide_adapters
    ],
    "agents": [
      ${agent_adapters:-}
    ]
  }
}
PROJECT_MANAGER_JSON

  success "Generated .project-manager.json (features empty — use AI Scan in the UI to populate)"
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_install() {
  header "Project Manager — Full Install"
  check_xcode_clt
  check_homebrew
  check_node
  check_rust
  check_linux_deps
  npm_install
  rust_check
  auto_generate_config
  mark_installed
  echo ""
  success "Installation complete. Run ./start_project_manager.sh start to launch Project Manager."
}

cmd_update() {
  header "Project Manager — Update"
  if ! is_installed; then
    warn "Project Manager not yet installed. Running full install instead…"
    cmd_install
    return
  fi
  npm_update
  rust_check
  echo ""
  success "Update complete."
}

cmd_start() {
  header "Project Manager — Start"
  start_project_manager "foreground"
}

cmd_start_background() {
  header "Project Manager — Start (background)"
  start_project_manager "background"
}

start_project_manager() {
  local mode="${1:-foreground}"
  local pm_url="http://localhost:${DEV_PORT}/project-progress-dashboard"
  local dev_server_running=0
  local log_file="$SCRIPT_DIR/.project-manager/dev-logs/project-manager-desktop.log"

  if is_port_listening "$DEV_PORT"; then
    dev_server_running=1
  fi

  # Ensure cargo is in PATH
  if [[ -f "$HOME/.cargo/env" ]]; then
    source "$HOME/.cargo/env"
  fi

  if ! is_installed; then
    warn "First run detected — running install first…"
    cmd_install
    echo ""
  fi

  cd "$SCRIPT_DIR"
  configure_tauri_dev_secret_backend
  ensure_dev_port_available

  if [[ "$mode" == "background" ]]; then
    local existing_desktop_pid
    existing_desktop_pid="$(running_pid_from_file "${log_file}.pid" || true)"
    if [[ -n "$existing_desktop_pid" ]]; then
      success "Project Manager desktop app already running (PID $existing_desktop_pid)"
      wait_for_port "$DEV_PORT" "Project Manager web app" || true
      maybe_open_local_url "$pm_url" "$dev_server_running"
      print_app_success "Project Manager desktop app" "$DEV_PORT" "$pm_url" "$log_file"
      return 0
    fi

    if is_port_listening "$DEV_PORT" && [[ "$dev_server_running" == "1" ]]; then
      success "Project Manager web app already running on port $DEV_PORT"
    fi
    start_background_service \
      "Project Manager desktop app" \
      "$log_file" \
      npm run tauri:dev
    wait_for_port "$DEV_PORT" "Project Manager web app" || true
    maybe_open_local_url "$pm_url" "$dev_server_running"
    print_app_success "Project Manager desktop app" "$DEV_PORT" "$pm_url" "$log_file"
    return 0
  fi

  maybe_open_local_url "$pm_url" "$dev_server_running"
  echo -e "${CYAN}Launching Project Manager desktop app…${RESET}"
  echo -e "${CYAN}(Next.js will start on port ${DEV_PORT}, Tauri window will open shortly)${RESET}"
  echo ""
  npm run tauri:dev
}

cmd_web() {
  header "Project Manager — Web Server (Next.js only)"
  local pm_url="http://localhost:${DEV_PORT}/project-progress-dashboard"

  if ! is_installed; then
    warn "First run detected — running install first…"
    cmd_install
    echo ""
  fi

  cd "$SCRIPT_DIR"

  # Re-use an existing Next.js process rather than killing and restarting it.
  local existing_pid
  existing_pid="$(lsof -nP -iTCP:"$DEV_PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
  if [[ -n "$existing_pid" ]] && is_next_process "$existing_pid"; then
    if is_dev_server_healthy; then
      success "Next.js dev server already running — http://localhost:${DEV_PORT}  (PID ${existing_pid})"
      maybe_open_local_url "$pm_url" "1"
      return 0
    fi
    warn "Existing Next.js dev server is not serving the dashboard correctly. Restarting…"
  fi

  ensure_dev_port_available
  maybe_open_local_url "$pm_url" "0"

  info "Starting Next.js dev server on http://localhost:${DEV_PORT}…"
  echo -e "${CYAN}(Ctrl-C to stop)${RESET}"
  echo ""
  npm run dev
}

cmd_hermes() {
  header "Hermes Agent — Dashboard"
  local log_file="$SCRIPT_DIR/.project-manager/dev-logs/hermes-dashboard.log"
  local url="http://127.0.0.1:${HERMES_PORT}"
  local already_running=0

  if [[ "$FORCE_RESTART" == "1" ]]; then
    stop_listeners_on_port "$HERMES_PORT" "Hermes Dashboard"
  fi

  if [[ ! -f "$SCRIPT_DIR/.project-manager/bin/hermes" ]]; then
    warn "Hermes not installed. Installing in Project Manager scope…"
    cd "$SCRIPT_DIR"
    npm run hermes:install || {
      print_app_failure "Hermes Agent Dashboard" "installer failed" "$log_file"
      return 1
    }
  fi

  if is_port_listening "$HERMES_PORT"; then
    already_running=1
    success "Hermes Dashboard already running — $url"
  else
    start_background_service \
      "Hermes Dashboard" \
      "$log_file" \
      npm run hermes:dashboard
    if ! wait_for_port "$HERMES_PORT" "Hermes Dashboard"; then
      print_app_failure "Hermes Agent Dashboard" "port $HERMES_PORT did not become ready" "$log_file"
      return 1
    fi
  fi

  maybe_open_local_url "$url" "$already_running"
  print_app_success "Hermes Agent Dashboard" "$HERMES_PORT" "$url" "$log_file"
}

cmd_openclaw() {
  header "OpenClaw — Gateway & Dashboard"
  local log_file="$SCRIPT_DIR/.project-manager/dev-logs/openclaw-gateway.log"
  local url="http://127.0.0.1:${OPENCLAW_PORT}/"
  local already_running=0

  if [[ "$FORCE_RESTART" == "1" ]]; then
    stop_listeners_on_port "$OPENCLAW_PORT" "OpenClaw Gateway"
  fi

  if [[ ! -f "$SCRIPT_DIR/.project-manager/bin/openclaw" ]]; then
    warn "OpenClaw not installed. Installing in Project Manager scope…"
    cd "$SCRIPT_DIR"
    npm run openclaw:install || {
      print_app_failure "OpenClaw Dashboard" "installer failed" "$log_file"
      return 1
    }
  fi

  export OPENCLAW_GATEWAY_PORT="$OPENCLAW_PORT"

  info "Syncing OpenClaw API keys and auth profiles from project .env…"
  if ! bash "$SCRIPT_DIR/scripts/sync-openclaw-env.sh"; then
    warn "OpenClaw env sync failed; chat may not work until API keys are configured"
  fi

  if is_port_listening "$OPENCLAW_PORT"; then
    already_running=1
    success "OpenClaw Gateway already running — $url"
  else
    start_background_service \
      "OpenClaw Gateway" \
      "$log_file" \
      npm run openclaw:gateway
    if ! wait_for_port "$OPENCLAW_PORT" "OpenClaw Gateway"; then
      print_app_failure "OpenClaw Dashboard" "gateway port $OPENCLAW_PORT did not become ready" "$log_file"
      return 1
    fi
  fi

  info "Preparing OpenClaw Dashboard token URL…"
  cd "$SCRIPT_DIR"
  if ! url="$(get_openclaw_dashboard_url)"; then
    print_app_failure "OpenClaw Dashboard" "failed to generate dashboard token URL" "$log_file"
    return 1
  fi

  maybe_open_local_url "$url" "$already_running"

  info "Approving local OpenClaw browser pairing requests automatically…"
  local approved_count
  approved_count="$(approve_openclaw_pending_pairings)"
  if [[ "$approved_count" =~ ^[0-9]+$ ]] && (( approved_count > 0 )); then
    success "Approved $approved_count OpenClaw local pairing request(s)"
    info "Opening OpenClaw Dashboard after pairing approval"
    open_local_url "$url"
  else
    success "No pending OpenClaw local pairing requests found"
  fi

  print_app_success "OpenClaw Dashboard" "$OPENCLAW_PORT" "http://127.0.0.1:${OPENCLAW_PORT}/" "$log_file"
}

cmd_aux() {
  open_auxiliary_app_pages
}

cmd_all() {
  header "Project Manager — Full Stack (PM + Hermes + OpenClaw + Aux Pages)"

  if [[ "$FORCE_RESTART" == "1" ]]; then
    stop_listeners_on_port "$HERMES_PORT" "Hermes Dashboard"
    stop_listeners_on_port "$OPENCLAW_PORT" "OpenClaw Gateway"
  fi

  if ! is_installed; then
    cmd_install
  fi

  cmd_start_background
  cmd_openclaw
  cmd_hermes
  cmd_aux

  header "Launch Summary"
  success "Project-scoped apps are ready (PM -> OpenClaw -> Hermes -> Aux)"
  echo "  Project Manager Desktop: started (Next.js dev port $DEV_PORT)"
  echo "  Hermes Agent Dashboard:  http://127.0.0.1:${HERMES_PORT}"
  echo "  OpenClaw Dashboard:      http://127.0.0.1:${OPENCLAW_PORT}/"
  echo "  Ollama API:              $OLLAMA_URL"
  echo "  Open WebUI:              $OPENWEBUI_URL"
  echo "  ComfyUI:                 $COMFYUI_URL"
  echo "  Logs:                    .project-manager/dev-logs/"
}

cmd_core() {
  header "Project Manager — Core Stack (PM + Hermes + OpenClaw)"

  if [[ "$FORCE_RESTART" == "1" ]]; then
    stop_listeners_on_port "$HERMES_PORT" "Hermes Dashboard"
    stop_listeners_on_port "$OPENCLAW_PORT" "OpenClaw Gateway"
  fi

  if ! is_installed; then
    cmd_install
  fi

  cmd_start_background
  cmd_openclaw
  cmd_hermes

  header "Launch Summary"
  success "Core apps are ready (PM -> OpenClaw -> Hermes)"
  echo "  Project Manager Desktop: started (Next.js dev port $DEV_PORT)"
  echo "  Project Manager Web App: http://localhost:${DEV_PORT}/"
  echo "  Hermes Agent Dashboard:  http://127.0.0.1:${HERMES_PORT}"
  echo "  OpenClaw Dashboard:      http://127.0.0.1:${OPENCLAW_PORT}/"
  echo "  Logs:                    .project-manager/dev-logs/"
}

cmd_stop() {
  header "Project Manager — Stopping Services"
  
  local ports=("$DEV_PORT" "$HERMES_PORT" "$OPENCLAW_PORT")
  for port in "${ports[@]}"; do
    local pids
    pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      warn "Stopping processes on port ${port}…"
      for pid in $pids; do
        kill_pid_if_running "$pid"
      done
      success "Port ${port} cleared"
    fi
  done
  success "All services stopped."
}

# ── Interactive Menu ──────────────────────────────────────────────────────────

show_menu() {
  clear
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BLUE}   Project Manager - 統一啟動選單 (Project Manager Menu) ${RESET}"
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${RESET}"
  echo -e " 1) 🚀 啟動全部 (PM + Hermes + OpenClaw + 輔助頁面)"
  echo -e " 2) ⚡ 只開必要頁面 (PM Web + PM Desktop + Hermes + OpenClaw)"
  echo -e " 3) 🖥️  啟動 PM 桌面端 (Tauri App)"
  echo -e " 4) 🌐 啟動 PM 網頁端 (Next.js Only)"
  echo -e " 5) 🤖 啟動 Hermes Agent Dashboard (Port: $HERMES_PORT)"
  echo -e " 6) 🕹️  啟動 OpenClaw Dashboard (Port: $OPENCLAW_PORT)"
  echo -e " 7) 🧩 開啟 Hermes / OpenClaw / Ollama / Open WebUI / ComfyUI 頁面"
  echo -e " ─── 管理功能 ───"
  echo -e " 8) 📥 執行完整安裝 (Full Install)"
  echo -e " 9) 🔄 更新相依性與 Rust 編譯 (Update)"
  echo -e "10) 🛑 停止所有相關服務"
  echo -e " 0) 🚪 離開 (Exit)"
  echo ""
  read -p "請輸入選項 (Enter choice): " choice

  case $choice in
    1) cmd_all ;;
    2) cmd_core ;;
    3) cmd_start ;;
    4) cmd_web ;;
    5) cmd_hermes ;;
    6) cmd_openclaw ;;
    7) cmd_aux ;;
    8) cmd_install ;;
    9) cmd_update ;;
    10) cmd_stop ;;
    0) exit 0 ;;
    *) warn "無效選項 (Invalid choice)"; sleep 1; show_menu ;;
  esac
}

cmd_auto() {
  if is_installed; then
    cmd_start
  else
    cmd_install
    echo ""
    cmd_start
  fi
}

# ── Entrypoint ────────────────────────────────────────────────────────────────

echo -e "${BOLD}"
cat << 'BANNER'
 ██████╗ ██████╗  ██████╗      ██╗███████╗ ██████╗████████╗
 ██╔══██╗██╔══██╗██╔═══██╗     ██║██╔════╝██╔════╝╚══██╔══╝
 ██████╔╝██████╔╝██║   ██║     ██║█████╗  ██║        ██║   
 ██╔═══╝ ██╔══██╗██║   ██║██   ██║██╔══╝  ██║        ██║   
 ██║     ██║  ██║╚██████╔╝╚██████╔╝███████╗╚██████╗   ██║   
 ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝ ╚═════╝   ╚═╝   

 ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗ ███████╗██████╗ 
 ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝ ██╔════╝██╔══██╗
 ██╔████╔██║███████║██╔██╗ ██║███████║██║  ███╗█████╗  ██████╔╝
 ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║   ██║██╔══╝  ██╔══██╗
 ██║ ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╔╝███████╗██║  ██║
 ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
BANNER
echo -e "${RESET}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force-open|--open)
      FORCE_OPEN=1
      shift
      ;;
    --restart)
      FORCE_RESTART=1
      shift
      ;;
    -*)
      error "Unknown flag: $1"
      echo "Flags: --force-open (alias --open), --restart"
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

COMMAND="${1:-menu}"

case "$COMMAND" in
  install)  cmd_install ;;
  update)   cmd_update  ;;
  start)    cmd_start   ;;
  web)      cmd_web     ;;
  all)      cmd_all     ;;
  core)     cmd_core    ;;
  aux)      cmd_aux     ;;
  stop)     cmd_stop    ;;
  hermes)   cmd_hermes  ;;
  openclaw) cmd_openclaw ;;
  menu)     show_menu   ;;
  auto)     cmd_auto    ;;
  *)
    error "Unknown command: $COMMAND"
    echo "Usage: $0 [--force-open|--open] [--restart] [install|update|start|web|all|core|aux|stop|hermes|openclaw|menu]"
    exit 1
    ;;
esac
