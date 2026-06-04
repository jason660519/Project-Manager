#!/usr/bin/env bash
# Point this repo's git hooks at .githooks/ (version-controlled, no Husky dependency).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x .githooks/pre-commit .githooks/pre-push
git config core.hooksPath .githooks

echo "Installed git hooks → .githooks (core.hooksPath=$(git config core.hooksPath))"
echo "Pre-commit runs: npm run verify:static-export (when .ts/.tsx files are staged)"
echo "Pre-push runs: npm run verify:quick (set PM_PRE_PUSH_BASELINE=1 to force full baseline; CI runs baseline on PR/main)"
