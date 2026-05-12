#!/usr/bin/env bash
# DevPilot — one-click install / update / start
# Usage:
#   ./dev.sh          auto-detect and start (installs if needed)
#   ./dev.sh install  force full install check
#   ./dev.sh update   update npm deps + rebuild Rust
#   ./dev.sh start    start the Tauri desktop app
#   ./dev.sh web      start Next.js web server only (no Tauri)

set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_NODE=18
DEV_PORT=43187
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
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

ensure_dev_port_available() {
  local pids=()
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(lsof -nP -iTCP:"$DEV_PORT" -sTCP:LISTEN -t 2>/dev/null || true)

  if (( ${#pids[@]} == 0 )); then
    return 0
  fi

  warn "Port $DEV_PORT is currently in use. Resolving conflict…"

  local force_kill="${DEVPILOT_FORCE_KILL_PORT:-0}"
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
    echo "  DEVPILOT_FORCE_KILL_PORT=1 ./dev.sh start"
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

STATE_FILE="$SCRIPT_DIR/.devpilot-installed"

mark_installed() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE_FILE"
}

is_installed() {
  [[ -f "$STATE_FILE" ]] && [[ -d "$SCRIPT_DIR/node_modules" ]]
}

# ── Auto-generate .dev-pilot.json ─────────────────────────────────────────────

auto_generate_config() {
  local config_file="$SCRIPT_DIR/.dev-pilot.json"

  if [[ -f "$config_file" ]]; then
    success ".dev-pilot.json already exists"
    return 0
  fi

  info "Generating .dev-pilot.json from project structure…"

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
  cat > "$config_file" << DEVPILOT_JSON
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
DEVPILOT_JSON

  success "Generated .dev-pilot.json (features empty — use AI Scan in the UI to populate)"
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_install() {
  header "DevPilot — Full Install"
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
  success "Installation complete. Run ./dev.sh start to launch DevPilot."
}

cmd_update() {
  header "DevPilot — Update"
  if ! is_installed; then
    warn "DevPilot not yet installed. Running full install instead…"
    cmd_install
    return
  fi
  npm_update
  rust_check
  echo ""
  success "Update complete."
}

cmd_start() {
  header "DevPilot — Start"

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
  echo -e "${CYAN}Launching DevPilot desktop app…${RESET}"
  echo -e "${CYAN}(Next.js will start on port ${DEV_PORT}, Tauri window will open shortly)${RESET}"
  echo ""
  npm run tauri:dev
}

cmd_web() {
  header "DevPilot — Web Server (Next.js only)"

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
  ██████╗ ███████╗██╗   ██╗    ██████╗ ██╗██╗      ██████╗ ████████╗
  ██╔══██╗██╔════╝██║   ██║    ██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝
  ██║  ██║█████╗  ██║   ██║    ██████╔╝██║██║     ██║   ██║   ██║
  ██║  ██║██╔══╝  ╚██╗ ██╔╝    ██╔═══╝ ██║██║     ██║   ██║   ██║
  ██████╔╝███████╗ ╚████╔╝     ██║     ██║███████╗╚██████╔╝   ██║
  ╚═════╝ ╚══════╝  ╚═══╝      ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝
BANNER
echo -e "${RESET}"

COMMAND="${1:-auto}"

case "$COMMAND" in
  install) cmd_install ;;
  update)  cmd_update  ;;
  start)   cmd_start   ;;
  web)     cmd_web     ;;
  auto)    cmd_auto    ;;
  *)
    error "Unknown command: $COMMAND"
    echo "Usage: $0 [install|update|start|web]"
    exit 1
    ;;
esac
