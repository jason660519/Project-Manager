#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
DOCS_DIR="$ROOT_DIR/docs"
EXIT_CODE=0

if [[ ! -d "$DOCS_DIR" ]]; then
  echo "[ERROR] docs directory not found: $DOCS_DIR"
  exit 1
fi

echo "== DevPilot Docs Governance Check =="

# 1) Ensure markdown filenames are English-safe.
echo "\n[1/4] Checking markdown filenames (ASCII-safe)..."
while IFS= read -r -d '' file; do
  base="$(basename "$file")"
  if [[ ! "$base" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "[FAIL] Non-English filename: $file"
    EXIT_CODE=1
  fi
done < <(find "$DOCS_DIR" -type f -name "*.md" -print0)

# 2) Ensure bilingual layout blocks exist in root technical docs.
echo "\n[2/4] Checking bilingual section layout in docs root..."
while IFS= read -r -d '' file; do
  if ! rg -q "^## English Version$" "$file"; then
    echo "[WARN] Missing '## English Version': $file"
    EXIT_CODE=1
  fi
  if ! rg -q "^## 中文版本$" "$file"; then
    echo "[WARN] Missing '## 中文版本': $file"
    EXIT_CODE=1
  fi
done < <(find "$DOCS_DIR" -maxdepth 1 -type f -name "*.md" -print0)

# 3) Ensure English section appears before Chinese section.
echo "\n[3/4] Checking section ordering..."
while IFS= read -r -d '' file; do
  en_line="$(rg -n "^## English Version$" "$file" | head -n1 | cut -d: -f1 || true)"
  zh_line="$(rg -n "^## 中文版本$" "$file" | head -n1 | cut -d: -f1 || true)"

  if [[ -n "$en_line" && -n "$zh_line" ]]; then
    if (( en_line >= zh_line )); then
      echo "[FAIL] English section is not above Chinese section: $file"
      EXIT_CODE=1
    fi
  fi
done < <(find "$DOCS_DIR" -type f -name "*.md" -print0)

# 4) Flag mixed bilingual headings in docs root files.
echo "\n[4/4] Checking mixed-language heading style in docs root..."
tmp_file="/tmp/devpilot_mixed_headings.txt"
rm -f "$tmp_file"

while IFS= read -r -d '' file; do
  while IFS= read -r line; do
    # Flag only headings that include both slash separator and Chinese characters.
    if [[ "$line" =~ ^[0-9]+:##\ .*\ /\ .* ]] && [[ "$line" =~ [一-龥] ]]; then
      echo "$file:$line" >> "$tmp_file"
    fi
  done < <(rg -n "^## .* / .*" "$file" || true)
done < <(find "$DOCS_DIR" -maxdepth 1 -type f -name "*.md" -print0)

if [[ -s "$tmp_file" ]]; then
  echo "[WARN] Mixed heading style found (use separated language blocks):"
  cat "$tmp_file"
  EXIT_CODE=1
else
  echo "[PASS] No mixed bilingual heading pattern found in docs root H2 headings."
fi

echo "\n== Check complete =="
if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo "[PASS] Docs governance checks passed."
else
  echo "[FAIL] Docs governance checks failed."
fi

exit "$EXIT_CODE"
