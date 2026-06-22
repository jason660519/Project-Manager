#!/usr/bin/env bash
# Project Manager — single verification gate for AI engineers and ship workflow.
# All steps must pass before claiming "done", opening a PR, or marking a feature 100%.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Project Manager verify:baseline =="
echo "Root: $ROOT"
echo ""

run() {
  echo "→ $*"
  "$@"
  echo ""
}

run npm run typecheck
run npm run agents:check
run npm run docs:check
run npm run docs:site:check
run node scripts/audit-table-sheets.mjs --check --fail-on-warnings
run node scripts/check-static-export-hygiene.mjs
run node scripts/check-native-dialogs.mjs
run node scripts/check-ui-i18n.mjs
run npm test

if command -v cargo >/dev/null 2>&1; then
  run cargo check --manifest-path src-tauri/Cargo.toml
else
  echo "→ cargo check — SKIPPED (cargo not in PATH; run locally or in CI)"
  echo ""
fi

run npm run build

echo "== verify:baseline: PASS =="
echo "Manual smoke (required for UI changes, not automated here):"
echo "  1. npm run dev  OR  npm run tauri:dev"
echo "  2. Open the changed route in Chrome/Safari/Tauri — NOT Cursor embedded browser alone"
echo "  3. Confirm browser console has no hydration/React errors"
echo "  4. Run: npm run verify:dev-issues -- --routes /changed-route"
echo "See docs/engineering/verification-runbook.md §6"
