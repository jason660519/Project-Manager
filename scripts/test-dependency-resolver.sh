#!/usr/bin/env bash
# Smoke tests for scripts/dependency-resolver.sh (no network installs).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PM_ROOT="$ROOT"
export PLATFORM="macOS"

# Minimal stubs for sourced resolver
info() { :; }
success() { :; }
warn() { :; }
error() { echo "error: $*" >&2; }

# shellcheck source=scripts/dependency-resolver.sh
source "$ROOT/scripts/dependency-resolver.sh"

pass=0
fail=0

assert() {
  local label="$1"
  shift
  if "$@"; then
    echo "PASS: $label"
    pass=$((pass + 1))
  else
    echo "FAIL: $label" >&2
    fail=$((fail + 1))
  fi
}

assert_not() {
  local label="$1"
  shift
  if "$@"; then
    echo "FAIL: $label" >&2
    fail=$((fail + 1))
  else
    echo "PASS: $label"
    pass=$((pass + 1))
  fi
}

REAL_HOME="$HOME"
# Negative test with empty HOME so nvm/fnm paths are not scanned
HOME="/tmp/pm-dep-test-empty-$$"
mkdir -p "$HOME"
PATH="/usr/bin:/bin"
export HOME PATH
assert_not "dep_discover_node false when no node installs exist" dep_discover_node
rm -rf "$HOME"

# Restore real HOME for nvm discovery test
HOME="$REAL_HOME"
if [[ -d "$HOME/.nvm/versions/node" ]]; then
  PATH="/usr/bin:/bin"
  export PATH
  assert "dep_discover_node finds nvm versioned node" dep_discover_node
  assert "node becomes available after discover" command -v node
fi

echo ""
echo "Results: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
