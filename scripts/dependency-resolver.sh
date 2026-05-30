#!/usr/bin/env bash
# Interactive dependency discovery and optional install for Project Manager.
# Sourced by start_project_manager.sh — do not run directly.
#
# Environment:
#   PM_AUTO_INSTALL=1|0     Non-interactive yes/no for all install prompts
#   PM_ROOT                 Repo root (set by parent script)
#
# Flags (parsed by parent):
#   --yes-deps              Auto-confirm dependency installs
#   --no-deps               Never install; fail when a tool is missing

if [[ -z "${PM_ROOT:-}" ]]; then
  PM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

DEP_LOG_FILE="${PM_ROOT}/.project-manager/dev-logs/dependency-install.log"
DEP_MIN_NODE="${DEP_MIN_NODE:-18}"

dep_init_log() {
  mkdir -p "$(dirname "$DEP_LOG_FILE")"
  {
    echo "=== Dependency resolver $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
  } >>"$DEP_LOG_FILE"
}

dep_is_tty() {
  [[ -t 0 && -t 1 ]]
}

dep_auto_install_decision() {
  # Global --yes-deps / --no-deps from parent
  if [[ "${PM_INSTALL_DEPS:-}" == "yes" ]]; then
    return 0
  fi
  if [[ "${PM_INSTALL_DEPS:-}" == "no" ]]; then
    return 1
  fi
  case "${PM_AUTO_INSTALL:-}" in
    1|true|yes|YES) return 0 ;;
    0|false|no|NO) return 1 ;;
  esac
  dep_is_tty
}

dep_confirm_install() {
  local title="$1"
  local risk="$2"
  local action="$3"

  echo ""
  echo -e "${YELLOW}⚠ Missing dependency: ${title}${RESET}"
  echo -e "${YELLOW}Risk / impact:${RESET}"
  echo "$risk" | sed 's/^/  /'
  echo ""
  echo -e "${CYAN}Proposed action:${RESET} $action"

  if ! dep_auto_install_decision; then
    if [[ "${PM_INSTALL_DEPS:-}" == "no" || "${PM_AUTO_INSTALL:-}" == "0" ]]; then
      warn "Dependency install declined (--no-deps or PM_AUTO_INSTALL=0)."
      return 1
    fi
    warn "Non-interactive shell — cannot prompt. Re-run in a terminal or pass --yes-deps."
    return 1
  fi

  local reply
  read -r -p "Install now? [y/N] " reply
  case "${reply:-}" in
    y|Y|yes|YES) return 0 ;;
    *) warn "Skipped install for: $title"; return 1 ;;
  esac
}

dep_run_with_progress() {
  local label="$1"
  shift
  dep_init_log
  info "$label…"
  echo -e "${CYAN}(live output — also logged to .project-manager/dev-logs/dependency-install.log)${RESET}"
  set +e
  {
    echo "--- $label $(date -u +"%Y-%m-%dT%H:%M:%SZ") ---"
    "$@"
  } 2>&1 | tee -a "$DEP_LOG_FILE"
  local exit_code="${PIPESTATUS[0]}"
  set -e
  if (( exit_code == 0 )); then
    success "$label complete"
    return 0
  fi
  error "$label failed (exit $exit_code). See $DEP_LOG_FILE"
  return "$exit_code"
}

dep_prepend_path_dir() {
  local dir="$1"
  if [[ -d "$dir" && ":$PATH:" != *":$dir:"* ]]; then
    export PATH="$dir:$PATH"
  fi
}

# Try nvm, fnm, and common install locations without prompting.
dep_discover_node() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi

  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$HOME/.nvm/nvm.sh"
    command -v node >/dev/null 2>&1 && return 0
  fi

  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --shell bash 2>/dev/null || fnm env 2>/dev/null || true)"
    command -v node >/dev/null 2>&1 && return 0
  fi

  local nvm_bin
  for nvm_bin in "$HOME/.nvm/versions/node/"*/bin; do
    [[ -d "$nvm_bin" ]] || continue
    dep_prepend_path_dir "$nvm_bin"
    command -v node >/dev/null 2>&1 && return 0
  done

  dep_prepend_path_dir "/opt/homebrew/bin"
  dep_prepend_path_dir "/usr/local/bin"
  command -v node >/dev/null 2>&1
}

dep_node_major_version() {
  node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1
}

dep_node_version_ok() {
  dep_discover_node || return 1
  local major
  major="$(dep_node_major_version)"
  [[ -n "$major" && "$major" =~ ^[0-9]+$ && "$major" -ge "$DEP_MIN_NODE" ]]
}

dep_install_node_via_nvm() {
  if [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
    return 1
  fi
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  dep_run_with_progress "Installing Node.js 20 via nvm" nvm install 20
  nvm alias default 20 >/dev/null 2>&1 || true
  nvm use 20 >/dev/null 2>&1 || true
  command -v node >/dev/null 2>&1
}

dep_install_node_via_brew() {
  dep_discover_node
  command -v brew >/dev/null 2>&1 || return 1
  dep_run_with_progress "Installing Node.js via Homebrew" brew install node
  dep_prepend_path_dir "/opt/homebrew/bin"
  dep_prepend_path_dir "/usr/local/bin"
  command -v node >/dev/null 2>&1
}

dep_install_node_via_nvm_bootstrap() {
  dep_run_with_progress "Downloading nvm installer" \
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh -o /tmp/pm-nvm-install.sh
  dep_run_with_progress "Installing nvm (Node Version Manager)" bash /tmp/pm-nvm-install.sh
  rm -f /tmp/pm-nvm-install.sh
  dep_install_node_via_nvm
}

dep_install_node_interactive() {
  local risk
  risk=$'• Downloads and installs Node.js (via nvm or Homebrew).\n• nvm modifies ~/.zshrc / ~/.bashrc to load Node in new shells.\n• Homebrew may install build dependencies and use disk space.\n• Requires network access during install.'

  if ! dep_confirm_install "Node.js (v${DEP_MIN_NODE}+)" "$risk" "Install Node.js 20 and add it to this shell session"; then
    return 1
  fi

  if dep_install_node_via_nvm; then
    success "Node.js ready: $(node --version)"
    return 0
  fi

  if dep_install_node_via_brew; then
    success "Node.js ready: $(node --version)"
    return 0
  fi

  if dep_confirm_install "nvm bootstrap" "$risk" "Install nvm, then Node.js 20"; then
    dep_install_node_via_nvm_bootstrap
    success "Node.js ready: $(node --version)"
    return 0
  fi

  return 1
}

dep_ensure_node() {
  if dep_node_version_ok; then
    success "Node.js found: $(node --version)"
    return 0
  fi

  if dep_discover_node; then
    local major
    major="$(dep_node_major_version)"
    warn "Node.js v${major:-?} is below minimum v${DEP_MIN_NODE}."
  else
    warn "Node.js not found on PATH (checked nvm, fnm, Homebrew paths)."
  fi

  dep_install_node_interactive
}

dep_ensure_npm() {
  dep_ensure_node || return 1
  if command -v npm >/dev/null 2>&1; then
    success "npm found: $(npm --version)"
    return 0
  fi
  error "npm is missing even though node is installed. Reinstall Node.js."
  return 1
}

dep_ensure_brew() {
  [[ "${PLATFORM:-macOS}" == "macOS" ]] || return 0
  dep_prepend_path_dir "/opt/homebrew/bin"
  if command -v brew >/dev/null 2>&1; then
    success "Homebrew found: $(brew --version | head -1)"
    return 0
  fi

  local risk
  risk=$'• Installs Homebrew package manager to /opt/homebrew (Apple Silicon) or /usr/local (Intel).\n• Runs a curl pipe to install script from brew.sh.\n• May prompt for sudo / Xcode CLT if missing.'

  if ! dep_confirm_install "Homebrew" "$risk" "/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""; then
    return 1
  fi

  dep_run_with_progress "Installing Homebrew" \
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi

  command -v brew >/dev/null 2>&1
}

dep_ensure_xcode_clt() {
  [[ "${PLATFORM:-macOS}" == "macOS" ]] || return 0
  if xcode-select -p &>/dev/null; then
    success "Xcode Command Line Tools found"
    return 0
  fi

  local risk
  risk=$'• Opens Apple\'s GUI installer for Xcode Command Line Tools.\n• Required for Rust, native npm modules, and Tauri builds.\n• You must complete the GUI install before this script can continue.'

  if ! dep_confirm_install "Xcode Command Line Tools" "$risk" "xcode-select --install (GUI)"; then
    return 1
  fi

  xcode-select --install
  warn "Complete the Xcode CLT installer dialog, then re-run this script."
  exit 0
}

dep_ensure_rust() {
  if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
    success "Rust found: $(rustc --version)"
    return 0
  fi

  local risk
  risk=$'• Installs rustup and the stable Rust toolchain to ~/.cargo.\n• Modifies shell profile to add ~/.cargo/bin to PATH.\n• Downloads several hundred MB from rustup.rs.'

  if ! dep_confirm_install "Rust (rustup)" "$risk" "curl https://sh.rustup.rs | sh -s -- -y"; then
    return 1
  fi

  dep_run_with_progress "Installing Rust via rustup" \
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/pm-rustup.sh
  sh /tmp/pm-rustup.sh -y --no-modify-path
  rm -f /tmp/pm-rustup.sh
  # shellcheck source=/dev/null
  [[ -f "$HOME/.cargo/env" ]] && source "$HOME/.cargo/env"
  command -v rustc >/dev/null 2>&1
}

dep_ensure_jq() {
  if command -v jq >/dev/null 2>&1; then
    return 0
  fi
  [[ "${PLATFORM:-macOS}" == "macOS" ]] || return 0

  local risk="• Installs jq JSON processor via Homebrew (small utility)."

  dep_ensure_brew || return 0
  if ! dep_confirm_install "jq" "$risk" "brew install jq"; then
    return 0
  fi
  dep_run_with_progress "Installing jq" brew install jq
}

dep_ensure_pm_runtime() {
  dep_ensure_npm
}

dep_ensure_pm_build() {
  dep_ensure_xcode_clt
  dep_ensure_brew
  dep_ensure_pm_runtime
  dep_ensure_rust
}

dep_maybe_install_sidecar() {
  local name="$1"
  local npm_script="$2"
  local binary_path="$3"

  if [[ -f "$binary_path" ]]; then
    return 0
  fi

  local risk
  risk=$'• Clones or updates third-party source under .project-manager/vendor/.\n• Runs npm/pnpm/uv build steps — may take several minutes.\n• Uses network bandwidth and disk space.\n• Sidecar is optional; Project Manager works without it.'

  if ! dep_confirm_install "${name} (project-scoped)" "$risk" "npm run ${npm_script}"; then
    return 1
  fi

  (cd "$PM_ROOT" && dep_run_with_progress "Installing ${name}" npm run "$npm_script")
  [[ -f "$binary_path" ]]
}

# Back-compat alias used by plugin mirror init and openclaw paths.
ensure_node_on_path() {
  dep_discover_node
}
