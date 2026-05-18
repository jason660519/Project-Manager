#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_SRC="${PM_HERMES_SRC:-$ROOT_DIR/.project-manager/vendor/hermes-agent}"
HERMES_HOME_DIR="${PM_HERMES_HOME:-$ROOT_DIR/.project-manager/hermes}"
HERMES_VENV="${PM_HERMES_VENV:-$HERMES_SRC/venv}"
MANIFEST="$HERMES_HOME_DIR/manifest.json"
TARGET_REF="${1:-origin/main}"

if [ ! -d "$HERMES_SRC/.git" ]; then
  echo "Hermes Agent source is not a git checkout: $HERMES_SRC" >&2
  echo "Run: npm run hermes:install" >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install uv first, then rerun npm run hermes:update." >&2
  exit 1
fi

mkdir -p "$HERMES_HOME_DIR"
export UV_NO_CONFIG=1
export HERMES_HOME="$HERMES_HOME_DIR"
previous_ref="$(git -C "$HERMES_SRC" rev-parse HEAD)"
restore_previous_ref() {
  echo "Hermes Agent update failed; restoring previous ref $previous_ref" >&2
  git -C "$HERMES_SRC" checkout "$previous_ref" >/dev/null 2>&1 || true
}
trap restore_previous_ref ERR

git -C "$HERMES_SRC" fetch --tags origin
git -C "$HERMES_SRC" checkout "$TARGET_REF"

if [ ! -d "$HERMES_VENV" ]; then
  uv venv "$HERMES_VENV" --python 3.11
fi

(
  cd "$HERMES_SRC"
  if [ -f uv.lock ]; then
    UV_PROJECT_ENVIRONMENT="$HERMES_VENV" uv sync --extra all --locked \
      || uv pip install --python "$HERMES_VENV/bin/python" -e ".[all]"
  else
    uv pip install --python "$HERMES_VENV/bin/python" -e ".[all]"
  fi
)

current_ref="$(git -C "$HERMES_SRC" rev-parse HEAD)"
current_desc="$(git -C "$HERMES_SRC" describe --tags --always --dirty 2>/dev/null || printf unknown)"
trap - ERR
node -e '
const fs = require("fs");
const path = process.argv[1];
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(path, "utf8")); } catch {}
manifest.pluginId = "hermes-agent";
manifest.sourcePath = process.argv[2];
manifest.runtimePath = process.argv[3];
manifest.venvPath = process.argv[4];
manifest.previousRef = process.argv[5];
manifest.currentRef = process.argv[6];
manifest.currentDescription = process.argv[7];
manifest.updatedAt = new Date().toISOString();
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
' "$MANIFEST" "$HERMES_SRC" "$HERMES_HOME_DIR" "$HERMES_VENV" "$previous_ref" "$current_ref" "$current_desc"
chmod 600 "$MANIFEST"

echo "Hermes Agent updated."
echo "Previous: $previous_ref"
echo "Current:  $current_ref ($current_desc)"
