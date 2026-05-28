#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"

if ! command -v rg >/dev/null 2>&1; then
  echo "[ERROR] ripgrep is required for hard-coded color checks." >&2
  exit 2
fi

hits="$(
  rg -n \
    --glob '!node_modules/**' \
    --glob '!.next/**' \
    --glob '!dist/**' \
    --glob '!build/**' \
    --glob '!src-tauri/icons/**' \
    --glob '!docs/**' \
    --glob '!lib/generated/**' \
    --glob '!public/vendor/**' \
    --glob '!lib/tokens/**' \
    --glob '!tailwind.config.*' \
    '#[0-9a-fA-F]{3,8}' \
    "$ROOT_DIR" || true
)"

if [[ -n "$hits" ]]; then
  echo "[P2] Hard-coded color values found outside allowed folders:"
  echo "$hits"
  echo
  echo "Replace literal hex colors with design tokens, Tailwind theme values, CSS system colors, or a documented token source."
  exit 1
fi

echo "[PASS] No hard-coded hex colors found outside allowed folders."
