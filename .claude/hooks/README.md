# .claude/hooks/

Project-scoped Claude Code hooks. Wired up via [`.claude/settings.json`](../settings.json) (committed, shared across the team).

## What's running

### `check-destructive.sh` — PreToolUse on `Bash`

Asks the user to confirm before executing destructive shell commands. Build / cache directories (`node_modules`, `.next`, `dist`, `out`, `target`, `src-tauri/target`, `coverage`, `__pycache__`, `.cache`, `.turbo`, `.swc`, `.pytest_cache`, `*.tsbuildinfo`) bypass the prompt for `rm -rf` so daily clean-up stays fast.

**Prompts on:**

| Category | Patterns |
|---|---|
| Filesystem | `rm -rf <not-in-safelist>` |
| Git (history rewrite) | `git push --force` / `-f` (allows `--force-with-lease`) |
| Git (working tree) | `git reset --hard`, `git checkout .`, `git checkout -- .`, `git restore .`, `git clean -fd` |
| Git (branch) | `git branch -D`, `git push <remote> :<branch>` |
| SQL | `DROP TABLE`, `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE` |
| Kubernetes | `kubectl delete`, `kubectl drain` |
| Docker | `docker system prune`, `docker volume rm`, `docker rm -f` |

**Fail-open by design.** A broken hook (script crash, timeout, missing python3) returns empty output → Claude treats it as `allow`. The hook MUST NEVER wedge a session.

### `test-check-destructive.sh` — manual regression harness

Runs 41 cases through the hook and asserts the expected `ask` / `allow` decision. Run from repo root:

```bash
bash .claude/hooks/test-check-destructive.sh
```

Exit code reflects PASS / FAIL so this is CI-ready if you ever want to wire it up.

## Extending

1. Open [`check-destructive.sh`](./check-destructive.sh)
2. Add a new labelled block near the bottom (e.g. `# ──── npm`)
3. Use `printf '%s' "$CMD" | grep -Eq '<regex>'` to detect, call `emit_ask "<reason>"` to prompt
4. Add a matching test case in [`test-check-destructive.sh`](./test-check-destructive.sh)
5. Re-run the harness — make sure both the new "ask" case AND a related "safe" case stay green
6. Commit the script change + the test additions together

## Disabling (per-developer)

Comment out the entry in [`../settings.json`](../settings.json) and stash the change locally, OR add a personal override in `.claude/settings.local.json` (already in `.gitignore`):

```json
{ "hooks": { "PreToolUse": [] } }
```

Reach out before disabling in long-running branches — the hook exists because the team got bitten by an unintended `rm -rf` / force-push at least once.
