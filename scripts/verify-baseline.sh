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

maybe_standards_check() {
  if [[ "${VERIFY_SKIP_STANDARDS:-}" == "1" ]]; then
    echo "→ standards:check — SKIPPED (VERIFY_SKIP_STANDARDS=1)"
    echo ""
    return
  fi
  local standards_root="${COMPANY_STANDARDS_ROOT:-/Users/Company-AI-App-Standards}"
  local standards_script="$standards_root/scripts/company-standards.sh"
  if [[ -x "$standards_script" ]]; then
    run "$standards_script" check .
    return
  fi
  echo "→ standards:check — SKIPPED (Company-AI-App-Standards not found at $standards_script)"
  echo "  Set COMPANY_STANDARDS_ROOT or run locally on a machine with the standards repo."
  echo ""
}

run npm run typecheck
maybe_standards_check
run npm run docs:check
run node scripts/check-static-export-hygiene.mjs
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
echo "See docs/engineering/verification-runbook.md §6"
