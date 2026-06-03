#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCHER="/Users/Project-Manager/start_project_manager.sh"
LOG_DIR="$ROOT/.project-manager/dev-logs"
LOG_FILE="$LOG_DIR/restart-after-tests.log"

mkdir -p "$LOG_DIR"

if [[ ! -x "$LAUNCHER" ]]; then
  echo "Project Manager launcher is not executable: $LAUNCHER" >&2
  exit 1
fi

run_tests=1
if [[ "${1:-}" == "--no-tests" ]]; then
  run_tests=0
  shift
fi

test_command=("$@")
if (( ${#test_command[@]} == 0 )); then
  test_command=(npm test)
fi

cd "$ROOT"

{
  echo "== restart-project-manager-after-tests =="
  echo "Root: $ROOT"
  echo "Launcher: $LAUNCHER"
  echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
} | tee "$LOG_FILE"

if [[ "$run_tests" == "1" ]]; then
  echo "Running test command: ${test_command[*]}" | tee -a "$LOG_FILE"
  set +e
  "${test_command[@]}" 2>&1 | tee -a "$LOG_FILE"
  test_status=${PIPESTATUS[0]}
  set -e

  if [[ "$test_status" -ne 0 ]]; then
    echo "Test command failed with status $test_status; Project Manager restart skipped." | tee -a "$LOG_FILE" >&2
    exit "$test_status"
  fi
else
  echo "Test command skipped by --no-tests." | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo "Tests passed. Resetting Project Manager test environment..." | tee -a "$LOG_FILE"

PROJECT_MANAGER_FORCE_KILL_PORT=1 "$LAUNCHER" --yes-deps restart 2>&1 | tee -a "$LOG_FILE"
launcher_status=${PIPESTATUS[0]}

if [[ "$launcher_status" -ne 0 ]]; then
  echo "Project Manager restart failed with status $launcher_status. See: $LOG_FILE" >&2
  exit "$launcher_status"
fi

final_wait_seconds="${PROJECT_MANAGER_AFTER_TEST_FINAL_CHECK_SECONDS:-15}"
echo "Waiting ${final_wait_seconds}s for final startup stability check..." | tee -a "$LOG_FILE"
sleep "$final_wait_seconds"

pid_file="$ROOT/.project-manager/dev-logs/project-manager-desktop.log.pid"
desktop_pid=""
if [[ -f "$pid_file" ]]; then
  desktop_pid="$(tr -dc '0-9' < "$pid_file" 2>/dev/null || true)"
fi

if [[ -z "$desktop_pid" ]] || ! kill -0 "$desktop_pid" 2>/dev/null; then
  echo "Project Manager restart failed final check: desktop launcher process is not running. See: $LOG_FILE" | tee -a "$LOG_FILE" >&2
  exit 1
fi

status="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:43187/project-progress-dashboard 2>/dev/null || true)"
if [[ "$status" != "200" ]]; then
  echo "Project Manager restart failed final check: dashboard health returned '${status:-no response}'. See: $LOG_FILE" | tee -a "$LOG_FILE" >&2
  exit 1
fi

echo "Final stability check passed: PID $desktop_pid, dashboard HTTP $status." | tee -a "$LOG_FILE"
echo "Project Manager restarted successfully. Log: $LOG_FILE"
