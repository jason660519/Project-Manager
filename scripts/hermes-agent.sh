#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_HOME_DIR="${PM_HERMES_HOME:-$ROOT_DIR/.project-manager/hermes}"
HERMES_BIN="$ROOT_DIR/.project-manager/bin/hermes"

if [ ! -x "$HERMES_BIN" ]; then
  echo "Project-scoped Hermes is not installed yet." >&2
  echo "Run: npm run hermes:install" >&2
  exit 1
fi

export HERMES_HOME="$HERMES_HOME_DIR"
exec "$HERMES_BIN" "$@"
