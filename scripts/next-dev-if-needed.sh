#!/usr/bin/env bash
# Tauri beforeDevCommand: start Next.js only when port 43187 is not already served by next dev.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_PORT=43187

is_next_process() {
  local pid="$1"
  local cmdline
  cmdline="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$cmdline" == *"next-server"* || "$cmdline" == *"next dev"* ]]
}

existing_pid="$(lsof -nP -iTCP:"$DEV_PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
if [[ -n "$existing_pid" ]] && is_next_process "$existing_pid"; then
  echo "Reusing Next.js dev server on http://localhost:${DEV_PORT} (PID ${existing_pid})"
  while kill -0 "$existing_pid" 2>/dev/null; do
    sleep 2
  done
  exit 0
fi

cd "$SCRIPT_DIR"
exec npm run dev
