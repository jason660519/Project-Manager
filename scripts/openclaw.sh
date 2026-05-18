#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_SRC="${PM_OPENCLAW_SRC:-$ROOT_DIR/.project-manager/vendor/openclaw}"
OPENCLAW_RUNTIME="${PM_OPENCLAW_RUNTIME:-$ROOT_DIR/.project-manager/openclaw}"
OPENCLAW_STATE_DIR="${PM_OPENCLAW_STATE_DIR:-$OPENCLAW_RUNTIME/state}"
OPENCLAW_WORKSPACE_DIR="${PM_OPENCLAW_WORKSPACE_DIR:-$OPENCLAW_RUNTIME/workspace}"
OPENCLAW_CONFIG_PATH="${PM_OPENCLAW_CONFIG_PATH:-$OPENCLAW_STATE_DIR/openclaw.json}"
OPENCLAW_ENV_FILE="$OPENCLAW_STATE_DIR/.env"

if [ ! -f "$OPENCLAW_SRC/package.json" ]; then
  echo "OpenClaw source not found at: $OPENCLAW_SRC" >&2
  echo "Run: npm run openclaw:install" >&2
  exit 1
fi

mkdir -p "$OPENCLAW_STATE_DIR" "$OPENCLAW_WORKSPACE_DIR"

if [ -f "$OPENCLAW_ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$OPENCLAW_ENV_FILE"
  set +a
fi

export OPENCLAW_HOME="$OPENCLAW_RUNTIME/home"
export OPENCLAW_STATE_DIR
export OPENCLAW_WORKSPACE_DIR
export OPENCLAW_CONFIG_PATH
export OPENCLAW_GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18790}"
export OPENCLAW_GATEWAY_BIND="${OPENCLAW_GATEWAY_BIND:-loopback}"
export OPENCLAW_NO_AUTO_UPDATE="${OPENCLAW_NO_AUTO_UPDATE:-1}"

if [ -f "$OPENCLAW_SRC/dist/entry.js" ] || [ -f "$OPENCLAW_SRC/dist/entry.mjs" ]; then
  exec node "$OPENCLAW_SRC/openclaw.mjs" "$@"
fi

exec pnpm --dir "$OPENCLAW_SRC" openclaw -- "$@"
