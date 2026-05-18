#!/usr/bin/env bash
# Manual test harness for check-destructive.sh.
# Run from repo root:  bash .claude/hooks/test-check-destructive.sh
#
# Each case feeds a Claude-Code-shaped JSON payload into the hook and
# greps the output for the expected decision. Exits non-zero on any
# regression so you can wire this into CI later if you want.

set -uo pipefail

HOOK="$(dirname "$0")/check-destructive.sh"
PASS=0
FAIL=0

run_case() {
  local label="$1"
  local cmd="$2"
  local want="$3"  # "ask" or "allow"

  local payload
  payload=$(python3 -c '
import json, sys
print(json.dumps({"tool_name": "Bash", "tool_input": {"command": sys.argv[1]}}))
' "$cmd")

  local out
  out=$(printf '%s' "$payload" | bash "$HOOK" 2>/dev/null)
  local got
  got=$(printf '%s' "$out" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d["hookSpecificOutput"]["permissionDecision"])
except Exception:
    print("PARSE_ERROR")
' 2>/dev/null)

  if [ "$got" = "$want" ]; then
    printf '  ✓ %-50s  → %s\n' "$label" "$got"
    PASS=$((PASS + 1))
  else
    printf '  ✗ %-50s  expected %s, got %s\n' "$label" "$want" "$got"
    printf '    cmd:    %s\n' "$cmd"
    printf '    output: %s\n' "$out"
    FAIL=$((FAIL + 1))
  fi
}

echo "== rm -rf =="
run_case "rm -rf node_modules (safe)"          "rm -rf node_modules"                "allow"
run_case "rm -rf .next (safe)"                  "rm -rf .next"                       "allow"
run_case "rm -rf src-tauri/target (safe)"       "rm -rf src-tauri/target"            "allow"
run_case "rm -rf out (safe)"                    "rm -rf out"                         "allow"
run_case "rm -rf /tmp/foo (dangerous)"          "rm -rf /tmp/foo"                    "ask"
run_case "rm -rf .git (dangerous)"              "rm -rf .git"                        "ask"
run_case "rm -rf ../other (dangerous)"          "rm -rf ../other"                    "ask"
run_case "rm -rf node_modules /tmp/foo (mixed)" "rm -rf node_modules /tmp/foo"       "ask"

echo
echo "== git destructive =="
run_case "git push --force"                     "git push --force"                   "ask"
run_case "git push origin main -f"              "git push origin main -f"            "ask"
run_case "git push --force-with-lease (safe)"   "git push --force-with-lease"        "allow"
run_case "git reset --hard"                     "git reset --hard HEAD~1"            "ask"
run_case "git checkout ."                       "git checkout ."                     "ask"
run_case "git checkout -- ."                    "git checkout -- ."                  "ask"
run_case "git restore ."                        "git restore ."                      "ask"
run_case "git branch -D feature"                "git branch -D feature"              "ask"
run_case "git push origin :stale-branch"        "git push origin :stale-branch"      "ask"
run_case "git clean -fd"                        "git clean -fd"                      "ask"

echo
echo "== git safe variants =="
run_case "git status"                           "git status"                         "allow"
run_case "git add ."                            "git add ."                          "allow"
run_case "git commit -m 'msg'"                  "git commit -m 'msg'"                "allow"
run_case "git push origin main (safe)"          "git push origin main"               "allow"
run_case "git push -u origin feat"              "git push -u origin feat"            "allow"
run_case "git reset HEAD~1 (soft)"              "git reset HEAD~1"                   "allow"
run_case "git checkout main (branch switch)"    "git checkout main"                  "allow"
run_case "git restore --staged file"            "git restore --staged file.txt"      "allow"

echo
echo "== SQL =="
run_case "DROP TABLE users"                     "psql -c 'DROP TABLE users;'"        "ask"
run_case "DROP DATABASE app"                    "echo 'DROP DATABASE app;' | psql"   "ask"
run_case "TRUNCATE TABLE sessions"              "psql -c 'TRUNCATE TABLE sessions;'" "ask"
run_case "SELECT (safe)"                        "psql -c 'SELECT 1;'"                "allow"

echo
echo "== kubectl =="
run_case "kubectl delete pod"                   "kubectl delete pod foo"             "ask"
run_case "kubectl drain node"                   "kubectl drain node1"                "ask"
run_case "kubectl get pods (safe)"              "kubectl get pods"                   "allow"

echo
echo "== docker =="
run_case "docker system prune"                  "docker system prune -a"             "ask"
run_case "docker volume rm"                     "docker volume rm myvol"             "ask"
run_case "docker rm -f"                         "docker rm -f mycontainer"           "ask"
run_case "docker ps (safe)"                     "docker ps"                          "allow"

echo
echo "== misc safe =="
run_case "ls -la"                               "ls -la"                             "allow"
run_case "npm run build"                        "npm run build"                      "allow"
run_case "cargo check"                          "cargo check --manifest-path src-tauri/Cargo.toml" "allow"
run_case "cat package.json"                     "cat package.json"                   "allow"

echo
echo "================================================"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "================================================"
[ "$FAIL" -eq 0 ]
