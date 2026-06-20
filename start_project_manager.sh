#!/usr/bin/env bash
# Project Manager — one-click install / update / start
# Usage:
#   ./start_project_manager.sh           show interactive menu
#   ./start_project_manager.sh start     start the Tauri desktop app
#   ./start_project_manager.sh web       start Next.js web server only (no Tauri)
#   ./start_project_manager.sh all       start PM + optional sidecars and open all auxiliary pages
#   ./start_project_manager.sh core      start PM; autostart sidecars only when enabled in plugin mirror
#   ./start_project_manager.sh aux       open auxiliary software pages only
#   ./start_project_manager.sh install   force full install check
#   ./start_project_manager.sh update    update npm deps + rebuild Rust
#   ./start_project_manager.sh stop      stop all services
#   ./start_project_manager.sh restart   clean old PM tabs/processes, then start fresh in background
#   ./start_project_manager.sh hermes    start Hermes Agent dashboard only
#   ./start_project_manager.sh supabase start local Supabase Docker stack only
#
# Flags (any command):
#   --open, --force-open   open browser even when the service is already running
#   --restart              stop the target service port before starting (hermes/openclaw/all)
#   --yes-deps             auto-confirm missing dependency installs (non-interactive friendly)
#   --no-deps              never install dependencies; fail when a required tool is missing

set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_NODE=18
DEV_PORT=43187
HERMES_PORT=9119
OPENCLAW_PORT=18790
# Launcher profile: minimal | dev (dev merges config/samples/launcher.dev.json)
: "${PM_LAUNCHER_PROFILE:=dev}"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
BLUE="\033[34m"
RESET="\033[0m"

FORCE_OPEN=0
FORCE_RESTART=0
PM_INSTALL_DEPS=""
OPENED_URLS_SESSION=$'\n'

ensure_plugin_mirror() {
  local mirror_file="$SCRIPT_DIR/.project-manager/plugins.json"
  if [[ -f "$mirror_file" ]]; then
    return 0
  fi
  if dep_discover_node; then
    node "$SCRIPT_DIR/scripts/init-plugin-catalog-mirror.mjs" || true
  fi
}

plugin_should_autostart() {
  local plugin_id="$1"
  ensure_plugin_mirror
  bash "$SCRIPT_DIR/scripts/plugin-state.sh" autostart "$plugin_id"
}

maybe_autostart_sidecar() {
  local plugin_id="$1"
  local label="$2"
  local start_fn="$3"

  if plugin_should_autostart "$plugin_id"; then
    "$start_fn"
    return $?
  fi

  info "$label autostart skipped (enable plugin + autostart in Integrations Hub > Coding Tools)."
  return 0
}

sidecar_install_hint() {
  local name="$1"
  local npm_script="$2"
  cat <<EOF
${name} is not installed in this Project Manager scope.
Install from Integrations Hub > Coding Tools > ${name} > Install,
or run: npm run ${npm_script}
EOF
}

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

process_cwd() {
  local pid="$1"
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

is_project_manager_process() {
  local pid="$1"
  local cmdline cwd
  cmdline="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  cwd="$(process_cwd "$pid" || true)"

  [[ "$cmdline" == *"$SCRIPT_DIR"* ]] && return 0
  [[ "$cwd" == "$SCRIPT_DIR" ]] && return 0
  [[ "$cmdline" == *"target/debug/project-manager"* ]] && return 0
  [[ "$cmdline" == *"Project Manager.app/Contents/MacOS/Project Manager"* ]] && return 0
  return 1
}

kill_pid_if_running() {
  local pid="$1"
  if [[ "$pid" == "$$" ]]; then
    warn "Skipping current launcher process (PID $pid)"
    return 0
  fi
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

refresh_browser_tab_for_url() {
  local url="$1"

  if [[ "${PROJECT_MANAGER_BROWSER_REFRESH:-1}" == "0" ]]; then
    return 1
  fi
  if [[ "$PLATFORM" != "macOS" ]] || ! command -v osascript >/dev/null 2>&1; then
    return 1
  fi

  local local_origin_dedup="${PROJECT_MANAGER_LOCAL_ORIGIN_DEDUP:-1}"
  local result
  result="$(osascript -l JavaScript - "$url" "$local_origin_dedup" 2>/dev/null <<'JXA' || true
function run(argv) {
  const targetUrl = String(argv[0] || "");
  const localOriginDedup = String(argv[1] || "1") === "1";
  const browserNames = ["Google Chrome", "Microsoft Edge", "Brave Browser", "Safari"];

  function normalizeUrl(rawUrl) {
    let value = String(rawUrl || "");
    const hashIndex = value.indexOf("#");
    if (hashIndex >= 0) value = value.slice(0, hashIndex);
    const queryIndex = value.indexOf("?");
    if (queryIndex >= 0) value = value.slice(0, queryIndex);
    while (value.length > 8 && value.endsWith("/")) {
      value = value.slice(0, -1);
    }
    return value;
  }

  function canonicalHost(host) {
    const lowered = String(host || "").replace(/^\[|\]$/g, "").toLowerCase();
    if (lowered === "localhost" || lowered === "127.0.0.1" || lowered === "::1") {
      return "localhost";
    }
    return lowered;
  }

  function parseAuthority(url) {
    const match = String(url || "").match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/]+)/);
    if (!match) return null;
    const scheme = match[1].toLowerCase();
    const authority = match[2];
    let host = "";
    let port = "";

    if (authority.startsWith("[")) {
      host = authority.slice(1, authority.indexOf("]"));
      const remainder = authority.slice(authority.indexOf("]") + 1);
      if (remainder.startsWith(":")) port = remainder.slice(1);
    } else if (authority.includes(":")) {
      host = authority.slice(0, authority.indexOf(":"));
      port = authority.slice(authority.indexOf(":") + 1);
    } else {
      host = authority;
    }

    if (!port) {
      if (scheme === "http") port = "80";
      else if (scheme === "https") port = "443";
    }

    return { scheme, host: canonicalHost(host), port };
  }

  function isLocalUrl(url) {
    const parsed = parseAuthority(normalizeUrl(url));
    return parsed !== null && parsed.host === "localhost";
  }

  function originKey(url) {
    const parsed = parseAuthority(normalizeUrl(url));
    if (!parsed) return normalizeUrl(url);
    return parsed.scheme + "://" + parsed.host + ":" + parsed.port;
  }

  function tabMatches(tabUrl) {
    const normalizedTab = normalizeUrl(tabUrl);
    const normalizedTarget = normalizeUrl(targetUrl);
    if (normalizedTab === normalizedTarget) return true;
    if (localOriginDedup && isLocalUrl(tabUrl) && isLocalUrl(targetUrl)) {
      return originKey(tabUrl) === originKey(targetUrl);
    }
    return false;
  }

  function activateTab(browser, browserWindow, tabIndex) {
    try {
      browserWindow.activeTabIndex = tabIndex;
    } catch (error) {
      /* Safari versions differ; activating the window is still useful. */
    }
    try {
      browserWindow.index = 1;
    } catch (error) {
      /* ignore */
    }
    browser.activate();
  }

  function refreshTab(browserName, browser, browserWindow, browserTab, tabIndex) {
    const currentUrl = String(browserTab.url() || "");
    if (normalizeUrl(currentUrl) !== normalizeUrl(targetUrl)) {
      browserTab.url = targetUrl;
    } else if (browserName !== "Safari") {
      try {
        browserTab.reload();
      } catch (error) {
        browserTab.url = targetUrl;
      }
    } else {
      browserTab.url = targetUrl;
    }
    activateTab(browser, browserWindow, tabIndex);
    return "refreshed";
  }

  const normalizedTarget = normalizeUrl(targetUrl);

  for (const browserName of browserNames) {
    let browser;
    try {
      browser = Application(browserName);
    } catch (error) {
      continue;
    }
    if (!browser.running()) continue;

    try {
      for (const browserWindow of browser.windows()) {
        const tabs = browserWindow.tabs();
        for (let tabIndex = 1; tabIndex <= tabs.length; tabIndex += 1) {
          const browserTab = tabs[tabIndex - 1];
          try {
            const tabUrl = String(browserTab.url() || "");
            if (!tabMatches(tabUrl)) continue;
            return refreshTab(browserName, browser, browserWindow, browserTab, tabIndex);
          } catch (error) {
            /* try next tab */
          }
        }
      }
    } catch (error) {
      /* try next browser */
    }
  }

  return "not_found";
}
JXA
)"
  [[ "$result" == "refreshed" ]]
}

open_local_url() {
  local url="$1"
  local target_url
  target_url="$(normalize_browser_url "$url")"

  if [[ "${PROJECT_MANAGER_NO_OPEN:-0}" == "1" ]]; then
    success "Browser auto-open skipped: $(safe_url_for_display "$url")"
    return 0
  fi

  if [[ "$PLATFORM" == "macOS" ]] && refresh_browser_tab_for_url "$url"; then
    remember_session_opened_url "$target_url"
    success "Browser tab refreshed: $(safe_url_for_display "$url")"
    return 0
  fi

  if ! should_force_open_browser && session_has_url_opened "$target_url"; then
    success "Browser tab already handled in this run: $(safe_url_for_display "$url")"
    return 0
  fi

  if ! should_force_open_browser && browser_has_url_open "$url"; then
    remember_session_opened_url "$target_url"
    success "Browser tab already open (refresh unavailable): $(safe_url_for_display "$url")"
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

close_project_manager_browser_tabs() {
  if [[ "${PROJECT_MANAGER_SKIP_BROWSER_CLEANUP:-0}" == "1" ]]; then
    success "Browser tab cleanup skipped by PROJECT_MANAGER_SKIP_BROWSER_CLEANUP=1"
    return 0
  fi

  if [[ "$PLATFORM" != "macOS" ]] || ! command -v osascript >/dev/null 2>&1; then
    warn "Browser tab cleanup is only automated on macOS with osascript"
    return 0
  fi

  info "Closing old Project Manager browser tabs on port $DEV_PORT..."
  local output status closed_count timeout_seconds
  timeout_seconds="${PROJECT_MANAGER_BROWSER_CLEANUP_TIMEOUT_SECONDS:-8}"
  set +e
  output="$(perl -e 'my $seconds = shift @ARGV; alarm $seconds; exec @ARGV' \
    "$timeout_seconds" osascript -l JavaScript - "$DEV_PORT" 2>&1 <<'JXA'
function run(argv) {
  const devPort = String(argv[0] || "43187");
  const browserNames = ["Google Chrome", "Microsoft Edge", "Brave Browser", "Safari"];
  const escapedPort = devPort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const projectManagerUrlPattern = new RegExp(
    "^https?://(localhost|127\\.0\\.0\\.1|\\[::1\\]):" + escapedPort + "([/?#].*)?$",
    "i",
  );

  let closedCount = 0;
  const errors = [];

  for (const browserName of browserNames) {
    let browser;
    try {
      browser = Application(browserName);
    } catch (error) {
      continue;
    }
    if (!browser.running()) continue;

    try {
      for (const browserWindow of browser.windows()) {
        const tabsToClose = [];
        for (const browserTab of browserWindow.tabs()) {
          try {
            const tabUrl = String(browserTab.url() || "");
            if (projectManagerUrlPattern.test(tabUrl)) {
              tabsToClose.push(browserTab);
            }
          } catch (error) {
            errors.push(browserName + ": read tab URL failed: " + error);
          }
        }

        for (const browserTab of tabsToClose) {
          try {
            browserTab.close();
            closedCount += 1;
          } catch (error) {
            errors.push(browserName + ": close tab failed: " + error);
          }
        }
      }
    } catch (error) {
      errors.push(browserName + ": browser scan failed: " + error);
    }
  }

  if (errors.length > 0) {
    return String(closedCount) + "\nWARN " + errors.join("\nWARN ");
  }

  return String(closedCount);
}
JXA
)"
  status=$?
  set -e

  if [[ "$status" != "0" ]]; then
    warn "Browser tab cleanup failed or timed out after ${timeout_seconds}s: $output"
    return 1
  fi

  closed_count="$(printf '%s\n' "$output" | sed -n '1p')"
  if [[ "$closed_count" =~ ^[0-9]+$ ]]; then
    success "Closed $closed_count old Project Manager browser tab(s)"
    if [[ "$output" == *$'\nWARN '* ]]; then
      warn "Browser tab cleanup warnings:"
      printf '%s\n' "$output" | sed -n '2,$p' >&2
    fi
  else
    warn "Browser tab cleanup ran, but did not return a count: $output"
    return 1
  fi
}

terminate_project_manager_app_processes() {
  info "Stopping old Project Manager desktop app processes..."

  if [[ "$PLATFORM" == "macOS" ]] && command -v osascript >/dev/null 2>&1; then
    osascript -e 'tell application "Project Manager" to quit' >/dev/null 2>&1 || true
  fi

  local pid_file="$SCRIPT_DIR/.project-manager/dev-logs/project-manager-desktop.log.pid"
  local pid
  if [[ -f "$pid_file" ]]; then
    pid="$(tr -dc '0-9' < "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]]; then
      warn "Stopping tracked Project Manager desktop process (PID $pid)"
      kill_pid_if_running "$pid"
    fi
    rm -f "$pid_file"
  fi

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    [[ "$pid" == "$$" ]] && continue
    if ! is_project_manager_process "$pid"; then
      continue
    fi
    local cmdline
    cmdline="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    warn "Stopping old Project Manager process (PID $pid): ${cmdline:-unknown}"
    kill_pid_if_running "$pid"
  done < <(pgrep -f "(run-tauri-dev\.mjs|tauri dev|target/debug/project-manager|Project Manager\.app/Contents/MacOS/Project Manager)" 2>/dev/null || true)

  sleep 0.5

  local remaining
  remaining=""
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    if is_project_manager_process "$pid"; then
      remaining+="$pid "
    fi
  done < <(pgrep -f "(run-tauri-dev\.mjs|tauri dev|target/debug/project-manager|Project Manager\.app/Contents/MacOS/Project Manager)" 2>/dev/null || true)
  if [[ -n "${remaining// }" ]]; then
    error "Some Project Manager app processes are still running: $remaining"
    return 1
  fi

  success "Old Project Manager desktop app processes stopped"
}

clean_project_manager_test_environment() {
  header "Project Manager — Cleaning Old Test Environment"
  close_project_manager_browser_tabs
  terminate_project_manager_app_processes
  stop_listeners_on_port "$DEV_PORT" "Project Manager web app"

  if is_port_listening "$DEV_PORT"; then
    error "Port $DEV_PORT is still occupied after cleanup"
    return 1
  fi

  success "Project Manager test environment is clean"
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
  nohup "$@" </dev/null >> "$log_file" 2>&1 &
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

confirm_pm_background_ready() {
  local log_file="$1"
  local pid_file="${log_file}.pid"
  local stable_seconds="${PROJECT_MANAGER_START_STABILITY_SECONDS:-5}"

  if ! wait_for_pm_ready "Project Manager web app"; then
    print_app_failure "Project Manager desktop app" "dashboard route did not become healthy" "$log_file"
    return 1
  fi

  sleep "$stable_seconds"

  local pid
  pid="$(running_pid_from_file "$pid_file" || true)"
  if [[ -z "$pid" ]]; then
    print_app_failure "Project Manager desktop app" "background launcher process exited during startup" "$log_file"
    return 1
  fi

  if ! is_dev_server_healthy; then
    print_app_failure "Project Manager web app" "dashboard route became unhealthy after startup" "$log_file"
    return 1
  fi

  success "Project Manager background process is stable (PID $pid)"
}

print_app_success() {
  local name="$1"
  local port="$2"
  local url="$3"
  local log_file="${4:-}"
  success "$name opened successfully"
  echo "  Port: $port"
  echo "  URL:  $url"
  # Print a raw URL line to maximize terminal click-to-open compatibility.
  echo "  Open: $url"
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

export PM_ROOT="$SCRIPT_DIR"
export PLATFORM
# shellcheck source=scripts/dependency-resolver.sh
source "$SCRIPT_DIR/scripts/dependency-resolver.sh"
# shellcheck source=scripts/pm-launcher/aux-pages.sh
source "$SCRIPT_DIR/scripts/pm-launcher/aux-pages.sh"
# shellcheck source=scripts/pm-launcher/supabase-stack.sh
source "$SCRIPT_DIR/scripts/pm-launcher/supabase-stack.sh"

# ── Prerequisite checks ───────────────────────────────────────────────────────

check_xcode_clt() {
  dep_ensure_xcode_clt
}

check_homebrew() {
  dep_ensure_brew
}

check_node() {
  dep_ensure_node
}

check_rust() {
  dep_ensure_rust
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
  dep_ensure_pm_runtime || return 1
  cd "$SCRIPT_DIR"
  dep_run_with_progress "Installing npm dependencies" \
    npm install --prefer-offline --no-audit --no-fund
}

npm_update() {
  dep_ensure_pm_runtime || return 1
  cd "$SCRIPT_DIR"
  dep_run_with_progress "Updating npm dependencies" \
    npm install --no-audit --no-fund
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

  dep_ensure_pm_runtime || {
    error "Cannot start Project Manager without Node.js and npm."
    return 1
  }

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

  ensure_supabase_for_pm || warn "Local Supabase is unavailable; PM will run in local-files mode until the stack is healthy."

  if [[ "${PROJECT_MANAGER_REUSE_EXISTING:-0}" != "1" && "${PROJECT_MANAGER_START_CLEANED:-0}" != "1" ]]; then
    clean_project_manager_test_environment
    export PROJECT_MANAGER_START_CLEANED=1
    dev_server_running=0
  fi

  ensure_dev_port_available

  if [[ "$mode" == "background" ]]; then
    local existing_desktop_pid
    existing_desktop_pid="$(running_pid_from_file "${log_file}.pid" || true)"
    if [[ -n "$existing_desktop_pid" ]]; then
      success "Project Manager desktop app already running (PID $existing_desktop_pid)"
      confirm_pm_background_ready "$log_file"
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
    confirm_pm_background_ready "$log_file"
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

  dep_ensure_pm_runtime || {
    error "Cannot start the web server without Node.js and npm."
    return 1
  }

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
    if ! dep_maybe_install_sidecar "Hermes Agent" "hermes:install" "$SCRIPT_DIR/.project-manager/bin/hermes"; then
      error "$(sidecar_install_hint "Hermes Agent" "hermes:install")"
      return 1
    fi
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
    if ! dep_maybe_install_sidecar "OpenClaw" "openclaw:install" "$SCRIPT_DIR/.project-manager/bin/openclaw"; then
      error "$(sidecar_install_hint "OpenClaw" "openclaw:install")"
      return 1
    fi
  fi

  if ! dep_discover_node; then
    if ! dep_install_node_interactive; then
      error "Node.js is required for OpenClaw but was not found on PATH."
      return 1
    fi
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
    info "Refreshing OpenClaw Dashboard after pairing approval"
    refresh_browser_tab_for_url "$url" || open_local_url "$url"
  else
    success "No pending OpenClaw local pairing requests found"
  fi

  print_app_success "OpenClaw Dashboard" "$OPENCLAW_PORT" "http://127.0.0.1:${OPENCLAW_PORT}/" "$log_file"
}

cmd_aux() {
  open_auxiliary_app_pages
}

cmd_all() {
  header "Project Manager — Full Stack (PM + optional sidecars + Aux Pages)"

  if [[ "$FORCE_RESTART" == "1" ]]; then
    stop_listeners_on_port "$HERMES_PORT" "Hermes Dashboard"
    stop_listeners_on_port "$OPENCLAW_PORT" "OpenClaw Gateway"
  fi

  if ! is_installed; then
    cmd_install
  fi

  ensure_supabase_for_pm || warn "Local Supabase is unavailable; continuing without cloud backend."

  cmd_start_background
  maybe_autostart_sidecar "openclaw" "OpenClaw" cmd_openclaw
  maybe_autostart_sidecar "hermes-agent" "Hermes Agent" cmd_hermes
  cmd_aux

  header "Launch Summary"
  supabase_load_ports
  success "Project-scoped apps are ready (PM + Supabase + optional sidecars + reachable aux pages)"
  echo "  Project Manager Desktop: started"
  echo "  Project Manager URL:      http://localhost:${DEV_PORT}/project-progress-dashboard"
  echo "  Local Supabase API/Studio: ${SUPABASE_STUDIO_URL} (Dashboard login: supabase / supabase-local-dev)"
  echo "  Hermes Agent Dashboard:  http://127.0.0.1:${HERMES_PORT} (when running + configured)"
  echo "  OpenClaw Dashboard:      http://127.0.0.1:${OPENCLAW_PORT}/ (when running + configured)"
  echo "  Launcher profile:        ${PM_LAUNCHER_PROFILE} (aux pages from config/samples/launcher.*.json)"
  echo "  Logs:                    .project-manager/dev-logs/ + docker/supabase (docker compose logs)"
}

cmd_core() {
  header "Project Manager — Core Stack (PM + optional sidecars)"

  if [[ "$FORCE_RESTART" == "1" ]]; then
    stop_listeners_on_port "$HERMES_PORT" "Hermes Dashboard"
    stop_listeners_on_port "$OPENCLAW_PORT" "OpenClaw Gateway"
  fi

  if ! is_installed; then
    cmd_install
  fi

  ensure_supabase_for_pm || warn "Local Supabase is unavailable; continuing without cloud backend."

  cmd_start_background
  maybe_autostart_sidecar "openclaw" "OpenClaw" cmd_openclaw
  maybe_autostart_sidecar "hermes-agent" "Hermes Agent" cmd_hermes

  header "Launch Summary"
  supabase_load_ports
  success "Core apps are ready (PM + Supabase + optional sidecars)"
  echo "  Project Manager Desktop: started"
  echo "  Project Manager URL:      http://localhost:${DEV_PORT}/project-progress-dashboard"
  echo "  Project Manager Web App: http://localhost:${DEV_PORT}/"
  echo "  Local Supabase API/Studio: ${SUPABASE_STUDIO_URL} (Dashboard login: supabase / supabase-local-dev)"
  echo "  Hermes Agent Dashboard:  http://127.0.0.1:${HERMES_PORT} (when autostart enabled + installed)"
  echo "  OpenClaw Dashboard:      http://127.0.0.1:${OPENCLAW_PORT}/ (when autostart enabled + installed)"
  echo "  Logs:                    .project-manager/dev-logs/ + docker/supabase (docker compose logs)"
}

cmd_stop() {
  header "Project Manager — Stopping Services"

  terminate_project_manager_app_processes || true

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
  cmd_supabase_stop || true
  success "All services stopped."
}

cmd_restart() {
  clean_project_manager_test_environment
  FORCE_RESTART=1
  FORCE_OPEN=1
  export PROJECT_MANAGER_START_CLEANED=1
  cmd_start_background
}

# ── Interactive Menu ──────────────────────────────────────────────────────────

show_menu() {
  local menu_all menu_core
  supabase_load_ports
  menu_all="$(launcher_profile_query menu.all 2>/dev/null || echo '啟動 PM + Supabase + 已啟用 sidecar + 可連線的輔助頁面')"
  menu_core="$(launcher_profile_query menu.core 2>/dev/null || echo '啟動 PM + Supabase + 依 plugin 設定自動啟動 sidecar')"
  clear
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BLUE}   Project Manager - 統一啟動選單 (Project Manager Menu) ${RESET}"
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${RESET}"
  echo -e " 1) 🚀 ${menu_all}"
  echo -e " 2) ⚡ ${menu_core}"
  echo -e " 3) 🖥️  啟動 PM 桌面端 (Tauri App)"
  echo -e " 4) 🌐 啟動 PM 網頁端 (Next.js Only)"
  echo -e " 5) 🤖 啟動 Hermes Agent Dashboard (Port: $HERMES_PORT)"
  echo -e " 6) 🕹️  啟動 OpenClaw Dashboard (Port: $OPENCLAW_PORT)"
  echo -e " 7) 🗄️  啟動 Local Supabase Docker Stack (Port: ${SUPABASE_KONG_PORT:-54329})"
  echo -e " 8) 🧩 開啟已配置且可連線的輔助頁面 (profile: ${PM_LAUNCHER_PROFILE})"
  echo -e " ─── 管理功能 ───"
  echo -e " 9) 📥 執行完整安裝 (Full Install)"
  echo -e "10) 🔄 更新相依性與 Rust 編譯 (Update)"
  echo -e "11) 🛑 停止所有相關服務"
  echo -e "12) ♻️  清理舊測試環境並重啟 PM"
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
    7) cmd_supabase ;;
    8) cmd_aux ;;
    9) cmd_install ;;
    10) cmd_update ;;
    11) cmd_stop ;;
    12) cmd_restart ;;
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
    --yes-deps)
      PM_INSTALL_DEPS=yes
      shift
      ;;
    --no-deps)
      PM_INSTALL_DEPS=no
      shift
      ;;
    -*)
      error "Unknown flag: $1"
      echo "Flags: --force-open (alias --open), --restart, --yes-deps, --no-deps"
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
  restart)  cmd_restart ;;
  hermes)   cmd_hermes  ;;
  openclaw) cmd_openclaw ;;
  supabase) cmd_supabase ;;
  menu)     show_menu   ;;
  auto)     cmd_auto    ;;
  *)
    error "Unknown command: $COMMAND"
    echo "Usage: $0 [--force-open|--open] [--restart] [install|update|start|web|all|core|aux|stop|restart|hermes|openclaw|supabase|menu]"
    exit 1
    ;;
esac
