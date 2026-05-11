#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
MODE="${2:-fix}"
DOCS_DIR="$ROOT_DIR/docs"
DATE_TAG="$(date +%Y%m%d)"

if [[ ! -d "$DOCS_DIR" ]]; then
  echo "[ERROR] docs directory not found: $DOCS_DIR"
  exit 1
fi

echo "== DevPilot Docs Governance Fix =="
echo "[INFO] Root: $ROOT_DIR"
echo "[INFO] Mode: $MODE"

# 1) Auto-fix mixed bilingual headings in docs root.
echo "\n[1/3] Normalizing mixed bilingual headings in docs root..."
while IFS= read -r -d '' file; do
  tmp_file="${file}.tmp"
  awk '
    /^## .* \/ .*[一-龥]/ {
      split($0, parts, " / ");
      print parts[1];
      next;
    }
    { print }
  ' "$file" > "$tmp_file"
  mv "$tmp_file" "$file"
done < <(find "$DOCS_DIR" -maxdepth 1 -type f -name "*.md" -print0)

# 2) Optional archive mode.
# Usage:
#   ./scripts/docs-governance-fix.sh . archive docs/old.md
if [[ "$MODE" == "archive" ]]; then
  TARGET_FILE="${3:-}"
  if [[ -z "$TARGET_FILE" ]]; then
    echo "[ERROR] archive mode requires target file path (relative to repo)."
    echo "[USAGE] ./scripts/docs-governance-fix.sh . archive docs/some-file.md"
    exit 1
  fi

  ABS_TARGET="$ROOT_DIR/$TARGET_FILE"
  if [[ ! -f "$ABS_TARGET" ]]; then
    echo "[ERROR] target file not found: $ABS_TARGET"
    exit 1
  fi

  mkdir -p "$DOCS_DIR/archive"
  base_name="$(basename "$ABS_TARGET")"
  archived_name="archived-${DATE_TAG}-${base_name}"
  archive_path="$DOCS_DIR/archive/$archived_name"

  echo "\n[2/3] Archiving target file..."
  mv "$ABS_TARGET" "$archive_path"
  
  # Add archive notice at top if not present.
  if ! rg -q "^> ARCHIVED:" "$archive_path"; then
    tmp_archive="${archive_path}.tmp"
    {
      echo "> ARCHIVED: This file is deprecated and kept for historical reference."
      echo "> Archived Date: $(date +%Y-%m-%d)"
      echo
      cat "$archive_path"
    } > "$tmp_archive"
    mv "$tmp_archive" "$archive_path"
  fi

  echo "[PASS] Archived to: $archive_path"
else
  echo "\n[2/3] Archive step skipped (mode=fix)."
fi

# 3) Re-run checker.
echo "\n[3/3] Running governance checker..."
"$ROOT_DIR/scripts/docs-governance-check.sh" "$ROOT_DIR"

echo "\n== Fix complete =="
