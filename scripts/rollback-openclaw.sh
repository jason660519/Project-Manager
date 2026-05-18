#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_SRC="${PM_OPENCLAW_SRC:-$ROOT_DIR/.project-manager/vendor/openclaw}"
OPENCLAW_RUNTIME="${PM_OPENCLAW_RUNTIME:-$ROOT_DIR/.project-manager/openclaw}"
MANIFEST="$OPENCLAW_RUNTIME/manifest.json"
TARGET_REF="${1:-}"

if [ ! -d "$OPENCLAW_SRC/.git" ]; then
  echo "OpenClaw source is not a git checkout: $OPENCLAW_SRC" >&2
  exit 1
fi

if [ -z "$TARGET_REF" ]; then
  if [ ! -f "$MANIFEST" ]; then
    echo "No OpenClaw manifest found. Pass an explicit git ref to roll back to." >&2
    exit 1
  fi
  TARGET_REF="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!m.previousRef) process.exit(2); console.log(m.previousRef)' "$MANIFEST")" || {
    echo "No previousRef recorded. Pass an explicit git ref to roll back to." >&2
    exit 1
  }
fi

current_ref="$(git -C "$OPENCLAW_SRC" rev-parse HEAD)"
git -C "$OPENCLAW_SRC" checkout "$TARGET_REF"

(
  cd "$OPENCLAW_SRC"
  pnpm install --frozen-lockfile
  pnpm build
  pnpm ui:build
)

rolled_ref="$(git -C "$OPENCLAW_SRC" rev-parse HEAD)"
rolled_desc="$(git -C "$OPENCLAW_SRC" describe --tags --always --dirty 2>/dev/null || printf unknown)"
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
manifest.rolledBackAt = new Date().toISOString();
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
' "$MANIFEST" "$OPENCLAW_SRC" "$OPENCLAW_RUNTIME" "$current_ref" "$rolled_ref" "$rolled_desc"

echo "OpenClaw rolled back."
echo "Previous current: $current_ref"
echo "Current:          $rolled_ref ($rolled_desc)"
