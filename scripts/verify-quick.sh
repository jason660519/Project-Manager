#!/usr/bin/env bash
# Project Manager quick verification gate.
# Runs changed-file-aware checks for development and pre-commit workflows.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

echo "== Project Manager verify:quick =="
echo "Root: $ROOT"
echo ""

run() {
  echo "→ $*"
  if [[ "$DRY_RUN" == "0" ]]; then
    "$@"
  else
    echo "  dry-run: skipped execution"
  fi
  echo ""
}

collect_changed_files() {
  local files=()

  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    while IFS= read -r file; do
      [[ -n "$file" ]] && files+=("$file")
    done < <(git diff --name-only origin/main...HEAD)
  fi

  while IFS= read -r file; do
    [[ -n "$file" ]] && files+=("$file")
  done < <(git diff --name-only)

  while IFS= read -r file; do
    [[ -n "$file" ]] && files+=("$file")
  done < <(git diff --name-only --cached)

  while IFS= read -r file; do
    [[ -n "$file" ]] && files+=("$file")
  done < <(git ls-files --others --exclude-standard)

  if [[ "${#files[@]}" == "0" ]]; then
    return
  fi

  printf '%s\n' "${files[@]}" | sort -u
}

changed_files=()
while IFS= read -r file; do
  [[ -n "$file" ]] && changed_files+=("$file")
done < <(collect_changed_files)

if [[ "${#changed_files[@]}" == "0" ]]; then
  echo "No changed files detected against origin/main, the index, or the working tree."
  echo "For final landing, still run: npm run verify:baseline"
  exit 0
fi

echo "Changed files:"
printf '  %s\n' "${changed_files[@]}"
echo ""

has_docs=0
has_ts=0
has_tests=0
has_rust=0
has_shell=0
has_node_script=0
has_package=0
has_table=0
escalate_baseline=0
docs_only=1

for file in "${changed_files[@]}"; do
  case "$file" in
    docs/*|README.md|README.zh-Hant.md|CLAUDE.md|DESIGN.md|AGENTS.md|GEMINI.md|.project-manager/features/*)
      has_docs=1
      ;;
    *.md)
      has_docs=1
      ;;
    *)
      docs_only=0
      ;;
  esac

  case "$file" in
    schema/*|lib/types/*|lib/storage/*|config/samples/*)
      escalate_baseline=1
      ;;
    app/*|components/*|lib/*)
      if [[ "$file" == *.ts || "$file" == *.tsx ]]; then
        has_ts=1
      fi
      ;;
    __tests__/*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx)
      has_tests=1
      ;;
    src-tauri/*|src-tauri/**|Cargo.toml|Cargo.lock)
      has_rust=1
      ;;
    scripts/*.sh|*.sh)
      has_shell=1
      ;;
    scripts/*.mjs|scripts/*.js|*.mjs|*.js)
      has_node_script=1
      ;;
    package.json|package-lock.json)
      has_package=1
      ;;
    app/ui/views/*|components/table/*|components/sheets/*|components/layout/*|app/project-progress-dashboard/*)
      has_table=1
      ;;
  esac
done

if [[ "$escalate_baseline" == "1" ]]; then
  echo "High-risk schema/storage/config-shape change detected."
  echo "Escalating quick verification to full baseline."
  echo ""
  run npm run verify:baseline
  exit 0
fi

if [[ "$docs_only" == "1" ]]; then
  echo "Change class: docs-only / feature artifacts"
  run npm run docs:check
  echo "Skipped: typecheck, tests, cargo check, build (docs-only quick verification)."
  echo "For final landing, still run: npm run verify:baseline"
  exit 0
fi

echo "Change class: mixed or code"
echo ""

if [[ "$has_docs" == "1" ]]; then
  run npm run docs:check
else
  echo "→ docs:check — SKIPPED (no docs or feature artifacts changed)"
  echo ""
fi

if [[ "$has_shell" == "1" ]]; then
  for file in "${changed_files[@]}"; do
    if [[ "$file" == *.sh && -f "$file" ]]; then
      run bash -n "$file"
    fi
  done
else
  echo "→ shell syntax — SKIPPED (no shell scripts changed)"
  echo ""
fi

if [[ "$has_node_script" == "1" ]]; then
  for file in "${changed_files[@]}"; do
    if [[ ( "$file" == *.mjs || "$file" == *.js ) && -f "$file" ]]; then
      run node --check "$file"
    fi
  done
else
  echo "→ node script syntax — SKIPPED (no Node scripts changed)"
  echo ""
fi

if [[ "$has_ts" == "1" || "$has_package" == "1" || "$has_rust" == "1" ]]; then
  run npm run typecheck
else
  echo "→ typecheck — SKIPPED (no TS/UI/package/Rust bridge changes)"
  echo ""
fi

if [[ "$has_ts" == "1" || "$has_package" == "1" ]]; then
  run node scripts/check-static-export-hygiene.mjs
  run node scripts/check-native-dialogs.mjs
  run node scripts/check-ui-i18n.mjs
else
  echo "→ client hygiene — SKIPPED (no TS/UI/package changes)"
  echo ""
fi

if [[ "$has_table" == "1" ]]; then
  run node scripts/audit-table-sheets.mjs --check
else
  echo "→ table:sheet:audit — SKIPPED (no table/sheet surfaces changed)"
  echo ""
fi

if [[ "$has_ts" == "1" || "$has_tests" == "1" || "$has_package" == "1" ]]; then
  run npm test
else
  echo "→ npm test — SKIPPED (no TS/test/package changes)"
  echo ""
fi

if [[ "$has_rust" == "1" ]]; then
  if command -v cargo >/dev/null 2>&1; then
    run cargo check --manifest-path src-tauri/Cargo.toml
  else
    echo "→ cargo check — SKIPPED (cargo not in PATH; run locally or in CI)"
    echo ""
  fi
else
  echo "→ cargo check — SKIPPED (no Rust/Tauri changes)"
  echo ""
fi

echo "== verify:quick: PASS =="
echo "For final PR/main landing, run one merged-state baseline:"
echo "  npm run verify:baseline"
