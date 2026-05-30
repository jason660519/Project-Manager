#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${PATH:-/usr/bin:/bin}"
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
fi

pass=0
fail=0

assert_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "PASS: $label"
    pass=$((pass + 1))
  else
    echo "FAIL: $label (missing: $needle)" >&2
    fail=$((fail + 1))
  fi
}

minimal="$(node "$ROOT/scripts/resolve-launcher-profile.mjs" --profile minimal --root "$ROOT")"
dev="$(node "$ROOT/scripts/resolve-launcher-profile.mjs" --profile dev --root "$ROOT")"

assert_contains "minimal includes local sidecar pages" "$minimal" "hermes-dashboard"
assert_contains "minimal excludes dev LAN ollama by default" "$minimal" "openclaw-dashboard"
if [[ "$minimal" == *"192.168.1.6"* ]]; then
  echo "FAIL: minimal profile must not include hardcoded LAN IP" >&2
  fail=$((fail + 1))
else
  echo "PASS: minimal profile has no LAN IP"
  pass=$((pass + 1))
fi

assert_contains "dev profile merges LAN aux pages" "$dev" "192.168.1.6"
assert_contains "dev profile keeps loopback sidecars" "$dev" "hermes-dashboard"

tsv_count="$(node "$ROOT/scripts/resolve-launcher-profile.mjs" --profile dev --root "$ROOT" --aux-tsv | wc -l | tr -d ' ')"
if [[ "$tsv_count" -ge 5 ]]; then
  echo "PASS: dev aux-tsv emits merged entries ($tsv_count lines)"
  pass=$((pass + 1))
else
  echo "FAIL: expected >= 5 aux entries in dev profile, got $tsv_count" >&2
  fail=$((fail + 1))
fi

echo ""
echo "Results: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
