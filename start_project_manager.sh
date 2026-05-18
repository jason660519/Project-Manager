#!/usr/bin/env bash
# Project Manager — one-click install / update / start
# Usage:
#   ./start_project_manager.sh           show interactive menu
#   ./start_project_manager.sh start     start the Tauri desktop app
#   ./start_project_manager.sh web       start Next.js web server only (no Tauri)
#   ./start_project_manager.sh all       start PM + Hermes + OpenClaw
#   ./start_project_manager.sh install   force full install check
#   ./start_project_manager.sh update    update npm deps + rebuild Rust
#   ./start_project_manager.sh stop      stop all services
#   ./start_project_manager.sh hermes    start Hermes Agent dashboard only
#   ./start_project_manager.sh openclaw  start OpenClaw gateway and open dashboard

set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_NODE=18
DEV_PORT=43187
HERMES_PORT=9119
OPENCLAW_PORT=18790
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
BLUE="\033[34m"
RESET="\033[0m"

# ── Helpers ───────────────────────────────────────────────────────────────────

info()    { echo -e "${CYAN}▶ $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}" >&2; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

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

open_local_url() {
  local url="$1"
  if [[ "${PROJECT_MANAGER_NO_OPEN:-0}" == "1" ]]; then
    success "Browser auto-open skipped: $(safe_url_for_display "$url")"
    return 0
  fi

  if [[ "$PLATFORM" == "macOS" ]]; then
    open "$url" >/dev/null 2>&1 || warn "Could not open browser automatically: $url"
  else
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$url" >/dev/null 2>&1 || warn "Could not open browser automatically: $url"
    else
      warn "Open this URL manually: $url"
    fi
  fi
}

safe_url_for_display() {
  local url="$1"
  printf '%s\n' "${url%%#token=*}"
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

  warn "Port $DEV_PORT is currently in use. Resolving conflict…"

  local force_kill="${PROJECT_MANAGER_FORCE_KILL_PORT:-0}"
  local pid
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
  ensure_dev_port_available
  echo -e "${CYAN}Launching Project Manager desktop app…${RESET}"
  echo -e "${CYAN}(Next.js will start on port ${DEV_PORT}, Tauri window will open shortly)${RESET}"
  echo ""
  npm run tauri:dev
}

cmd_web() {
  header "Project Manager — Web Server (Next.js only)"

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
    success "Next.js dev server already running — http://localhost:${DEV_PORT}  (PID ${existing_pid})"
    return 0
  fi

  ensure_dev_port_available

  info "Starting Next.js dev server on http://localhost:${DEV_PORT}…"
  echo -e "${CYAN}(Ctrl-C to stop)${RESET}"
  echo ""
  npm run dev
}

cmd_hermes() {
  header "Hermes Agent — Dashboard"
  local log_file="$SCRIPT_DIR/.project-manager/dev-logs/hermes-dashboard.log"
  local url="http://127.0.0.1:${HERMES_PORT}"
  if [[ ! -f "$SCRIPT_DIR/.project-manager/bin/hermes" ]]; then
    warn "Hermes not installed. Installing in Project Manager scope…"
    cd "$SCRIPT_DIR"
    npm run hermes:install || {
      print_app_failure "Hermes Agent Dashboard" "installer failed" "$log_file"
      return 1
    }
  fi

  if is_port_listening "$HERMES_PORT"; then
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

  info "Opening Hermes Dashboard: $url"
  open_local_url "$url"
  print_app_success "Hermes Agent Dashboard" "$HERMES_PORT" "$url" "$log_file"
}

cmd_openclaw() {
  header "OpenClaw — Gateway & Dashboard"
  local log_file="$SCRIPT_DIR/.project-manager/dev-logs/openclaw-gateway.log"
  local url="http://127.0.0.1:${OPENCLAW_PORT}/"
  if [[ ! -f "$SCRIPT_DIR/.project-manager/bin/openclaw" ]]; then
    warn "OpenClaw not installed. Installing in Project Manager scope…"
    cd "$SCRIPT_DIR"
    npm run openclaw:install || {
      print_app_failure "OpenClaw Dashboard" "installer failed" "$log_file"
      return 1
    }
  fi

  export OPENCLAW_GATEWAY_PORT="$OPENCLAW_PORT"

  if is_port_listening "$OPENCLAW_PORT"; then
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

  info "Opening OpenClaw Dashboard: $(safe_url_for_display "$url")"
  open_local_url "$url"

  info "Approving local OpenClaw browser pairing requests automatically…"
  local approved_count
  approved_count="$(approve_openclaw_pending_pairings)"
  if [[ "$approved_count" =~ ^[0-9]+$ ]] && (( approved_count > 0 )); then
    success "Approved $approved_count OpenClaw local pairing request(s)"
    info "Re-opening OpenClaw Dashboard after pairing approval"
    open_local_url "$url"
  else
    success "No pending OpenClaw local pairing requests found"
  fi

  print_app_success "OpenClaw Dashboard" "$OPENCLAW_PORT" "http://127.0.0.1:${OPENCLAW_PORT}/" "$log_file"
}

cmd_all() {
  header "Project Manager — Full Stack (PM + Hermes + OpenClaw)"

  if ! is_installed; then
    cmd_install
  fi

  cmd_hermes
  cmd_openclaw

  header "Launch Summary"
  success "Project-scoped apps are ready"
  echo "  Project Manager Desktop: starting next (Next.js dev port $DEV_PORT)"
  echo "  Hermes Agent Dashboard:  http://127.0.0.1:${HERMES_PORT}"
  echo "  OpenClaw Dashboard:      http://127.0.0.1:${OPENCLAW_PORT}/"
  echo "  Logs:                    .project-manager/dev-logs/"
  echo ""

  # Finally start PM
  cmd_start
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
  echo -e " 1) 🚀 啟動完整環境 (PM + Hermes + OpenClaw)"
  echo -e " 2) 🖥️  啟動 PM 桌面端 (Tauri App)"
  echo -e " 3) 🌐 啟動 PM 網頁端 (Next.js Only)"
  echo -e " 4) 🤖 啟動 Hermes Agent Dashboard (Port: $HERMES_PORT)"
  echo -e " 5) 🕹️  啟動 OpenClaw Dashboard (Port: $OPENCLAW_PORT)"
  echo -e " ─── 管理功能 ───"
  echo -e " 6) 📥 執行完整安裝 (Full Install)"
  echo -e " 7) 🔄 更新相依性與 Rust 編譯 (Update)"
  echo -e " 8) 🛑 停止所有相關服務"
  echo -e " 0) 🚪 離開 (Exit)"
  echo ""
  read -p "請輸入選項 (Enter choice): " choice

  case $choice in
    1) cmd_all ;;
    2) cmd_start ;;
    3) cmd_web ;;
    4) cmd_hermes ;;
    5) cmd_openclaw ;;
    6) cmd_install ;;
    7) cmd_update ;;
    8) cmd_stop ;;
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

COMMAND="${1:-menu}"

case "$COMMAND" in
  install)  cmd_install ;;
  update)   cmd_update  ;;
  start)    cmd_start   ;;
  web)      cmd_web     ;;
  all)      cmd_all     ;;
  stop)     cmd_stop    ;;
  hermes)   cmd_hermes  ;;
  openclaw) cmd_openclaw ;;
  menu)     show_menu   ;;
  auto)     cmd_auto    ;;
  *)
    error "Unknown command: $COMMAND"
    echo "Usage: $0 [install|update|start|web|all|stop|hermes|openclaw|menu]"
    exit 1
    ;;
esac
