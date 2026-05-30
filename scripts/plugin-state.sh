#!/usr/bin/env bash
# Read plugin enabled/autostart flags from `.project-manager/plugins.json`.
# Usage:
#   scripts/plugin-state.sh enabled <plugin-id>   → exit 0 when true
#   scripts/plugin-state.sh autostart <plugin-id>   → exit 0 when enabled AND autostart
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIRROR_FILE="$ROOT_DIR/.project-manager/plugins.json"
ACTION="${1:-}"
PLUGIN_ID="${2:-}"

if [[ -z "$ACTION" || -z "$PLUGIN_ID" ]]; then
  echo "Usage: $0 <enabled|autostart> <plugin-id>" >&2
  exit 2
fi

if [[ ! -f "$MIRROR_FILE" ]]; then
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to read $MIRROR_FILE" >&2
  exit 2
fi

case "$ACTION" in
  enabled)
    jq -e --arg id "$PLUGIN_ID" '.plugins[$id].enabled == true' "$MIRROR_FILE" >/dev/null
    ;;
  autostart)
    jq -e --arg id "$PLUGIN_ID" '.plugins[$id].enabled == true and .plugins[$id].autostart == true' "$MIRROR_FILE" >/dev/null
    ;;
  *)
    echo "Unknown action: $ACTION (expected enabled or autostart)" >&2
    exit 2
    ;;
esac
