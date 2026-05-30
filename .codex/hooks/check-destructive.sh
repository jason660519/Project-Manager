#!/usr/bin/env bash
# PreToolUse hook for the Bash tool.
#
# Reads the tool input JSON on stdin, extracts the bash command, and asks
# the user to confirm if it matches a destructive pattern. Build-artefact
# directories (node_modules, .next, dist, target, ...) bypass the prompt
# for rm -rf so daily clean-up stays fast.
#
# Output contract (Claude Code hooks):
#   stdout JSON: {"hookSpecificOutput": {
#     "hookEventName": "PreToolUse",
#     "permissionDecision": "ask" | "allow",
#     "permissionDecisionReason": "..."
#   }}
#   exit 0 → JSON processed.
#   exit non-zero / crash / timeout → fail-open (Claude treats as allow).
#
# Fail-open is intentional: a broken hook MUST NOT wedge the user's session.
# Patterns to extend live in the labelled blocks below. Test cases live in
# .claude/hooks/test-check-destructive.sh.

set -uo pipefail

# Any uncaught error in this script → emit empty allow object and exit 0.
trap 'emit_allow_silent' ERR

emit_allow_silent() {
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
}

emit_ask() {
  python3 - "$1" <<'PY'
import json, sys
print(json.dumps({
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": sys.argv[1],
  }
}))
PY
  exit 0
}

emit_allow() {
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
}

INPUT="$(cat)"
CMD="$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print((d.get("tool_input") or {}).get("command", ""))
except Exception:
    pass
' 2>/dev/null)"

# Empty command (or non-Bash input routed here somehow) → allow.
[ -z "$CMD" ] && emit_allow

# ──────────────────────────────────────────────────────────── rm -rf
# Build/cache directories bypass the prompt. Anything else asks.
is_safe_rm_target() {
  case "$1" in
    node_modules|node_modules/*) return 0 ;;
    .next|.next/*) return 0 ;;
    .turbo|.turbo/*) return 0 ;;
    out|out/*) return 0 ;;
    dist|dist/*) return 0 ;;
    build|build/*) return 0 ;;
    coverage|coverage/*) return 0 ;;
    .cache|.cache/*) return 0 ;;
    .swc|.swc/*) return 0 ;;
    __pycache__|__pycache__/*) return 0 ;;
    .pytest_cache|.pytest_cache/*) return 0 ;;
    target|target/*) return 0 ;;
    src-tauri/target|src-tauri/target/*) return 0 ;;
    *.tsbuildinfo) return 0 ;;
  esac
  return 1
}

if printf '%s' "$CMD" | grep -Eq '(^|[[:space:]])rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*|--recursive)'; then
  # Naive target extraction: split on whitespace, ignore flags + the literal "rm".
  for word in $CMD; do
    case "$word" in
      rm|sudo|-*|--*) continue ;;
    esac
    if ! is_safe_rm_target "$word"; then
      emit_ask "rm -rf on '$word' (not in build-artefact safe-list: node_modules / .next / dist / out / target / __pycache__ / coverage / .cache pass silently). Approve only if you really want to recursively delete this."
    fi
  done
fi

# ──────────────────────────────────────────────────────────── git destructive
# git push --force (NOT --force-with-lease)
if printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+push([[:space:]]|[[:space:]][^|;&]*[[:space:]])(--force([[:space:]]|$)|-f([[:space:]]|$))'; then
  if ! printf '%s' "$CMD" | grep -q -- '--force-with-lease'; then
    emit_ask "git push --force detected — rewrites remote history, can erase teammates' work. Prefer --force-with-lease if you really must force-push."
  fi
fi

if printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+reset[[:space:]]+--hard'; then
  emit_ask "git reset --hard detected — discards all uncommitted changes in the working tree."
fi

# git checkout . / -- / -- .  (working-tree restore)
if printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+checkout[[:space:]]+(\.([[:space:]]|$)|--([[:space:]]+\.)?([[:space:]]|$))'; then
  emit_ask "git checkout . / -- detected — discards uncommitted edits in the working tree."
fi

if printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+restore[[:space:]]+\.([[:space:]]|$)'; then
  emit_ask "git restore . detected — discards uncommitted edits in the working tree."
fi

if printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+branch[[:space:]]+-D[[:space:]]'; then
  emit_ask "git branch -D detected — force-deletes a local branch even if unmerged."
fi

# git push remote :branch (delete remote branch)
if printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+push[[:space:]]+[[:alnum:]_/.-]+[[:space:]]+:[[:alnum:]_/.-]+'; then
  emit_ask "git push remote :branch detected — deletes the remote branch."
fi

# git clean -fd / -fdx (untracked file removal)
if printf '%s' "$CMD" | grep -Eq 'git[[:space:]]+clean[[:space:]]+(-[a-zA-Z]*f[a-zA-Z]*d[a-zA-Z]*|-[a-zA-Z]*d[a-zA-Z]*f[a-zA-Z]*)'; then
  emit_ask "git clean -fd detected — removes untracked files and directories."
fi

# ──────────────────────────────────────────────────────────── SQL
if printf '%s' "$CMD" | grep -Eiq '(DROP[[:space:]]+(TABLE|DATABASE|SCHEMA)|TRUNCATE([[:space:]]+TABLE)?[[:space:]])'; then
  emit_ask "SQL DROP / TRUNCATE detected. Confirm the target is a disposable database, not prod."
fi

# ──────────────────────────────────────────────────────────── kubectl
if printf '%s' "$CMD" | grep -Eq 'kubectl[[:space:]]+(delete|drain)[[:space:]]'; then
  emit_ask "kubectl delete / drain detected. Confirm cluster context + namespace before approving."
fi

# ──────────────────────────────────────────────────────────── docker
if printf '%s' "$CMD" | grep -Eq 'docker[[:space:]]+(system[[:space:]]+prune|volume[[:space:]]+rm|rm[[:space:]]+-f)'; then
  emit_ask "docker system prune / volume rm / rm -f detected. Confirm you don't need those volumes / containers."
fi

# All clear.
emit_allow
