#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_SRC="${PM_OPENCLAW_SRC:-$ROOT_DIR/.project-manager/vendor/openclaw}"
OPENCLAW_RUNTIME="${PM_OPENCLAW_RUNTIME:-$ROOT_DIR/.project-manager/openclaw}"
MANIFEST="$OPENCLAW_RUNTIME/manifest.json"
TARGET_REF="${1:-origin/main}"

if [ ! -d "$OPENCLAW_SRC/.git" ]; then
  echo "OpenClaw source is not a git checkout: $OPENCLAW_SRC" >&2
  exit 1
fi

mkdir -p "$OPENCLAW_RUNTIME"
previous_ref="$(git -C "$OPENCLAW_SRC" rev-parse HEAD)"

git -C "$OPENCLAW_SRC" fetch --tags origin
git -C "$OPENCLAW_SRC" checkout "$TARGET_REF"

(
  cd "$OPENCLAW_SRC"
  pnpm install --frozen-lockfile
  pnpm build
  pnpm ui:build
)

current_ref="$(git -C "$OPENCLAW_SRC" rev-parse HEAD)"
current_desc="$(git -C "$OPENCLAW_SRC" describe --tags --always --dirty 2>/dev/null || printf unknown)"
node -e '
const fs = require("fs");
const path = process.argv[1];
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(path, "utf8")); } catch {}
manifest.pluginId = "openclaw";
manifest.sourcePath = process.argv[2];
manifest.runtimePath = process.argv[3];
manifest.previousRef = process.argv[4];
manifest.currentRef = process.argv[5];
manifest.currentDescription = process.argv[6];
manifest.updatedAt = new Date().toISOString();
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
' "$MANIFEST" "$OPENCLAW_SRC" "$OPENCLAW_RUNTIME" "$previous_ref" "$current_ref" "$current_desc"

echo "OpenClaw updated."
echo "Previous: $previous_ref"
echo "Current:  $current_ref ($current_desc)"
