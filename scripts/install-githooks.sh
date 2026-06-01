#!/usr/bin/env bash
# Point this repo's git hooks at .githooks/ (version-controlled, no Husky dependency).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x .githooks/pre-commit
git config core.hooksPath .githooks

echo "Installed git hooks → .githooks (core.hooksPath=$(git config core.hooksPath))"
echo "Pre-commit runs: npm run verify:static-export (when .ts/.tsx files are staged)"
