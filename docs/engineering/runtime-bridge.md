# Runtime Bridge

> Status: Active  
> Last updated: 2026-06-03  
> Primary files: `lib/bridge/index.ts`, `src-tauri/src/lib.rs`, `app/api/bridge/execute/route.ts`, `app/api/anthropic/route.ts`

---

## English Version

## 1. Runtime Modes

Project Manager has two runtime modes:

| Mode | Detection | Intended Use | OS Access |
| --- | --- | --- | --- |
| Browser mode | `__TAURI_INTERNALS__` missing | `npm run dev`, browser preview, component testing | Limited to Next.js server routes |
| Tauri mode | `__TAURI_INTERNALS__` present | Desktop app and production behavior | Rust Tauri commands |

Browser mode must never be treated as production. It exists to keep UI development and tests fast.

## 2. Bridge Discipline

All renderer code must call wrappers in `lib/bridge/index.ts`. Components must not import `@tauri-apps/api/core` directly.

Reasons:

1. Browser fallback behavior stays centralized.
2. Tauri command signatures have one typed TypeScript contract.
3. Schema migration and secret boundaries stay enforceable.
4. Tests can mock one module instead of every component.

## 3. Command Contract

| Wrapper | Tauri Command | Browser Behavior | Notes |
| --- | --- | --- | --- |
| `readConfig(path)` | `read_config` | Throws | Output is piped through `migrateConfig()`. |
| `writeConfig(path, config)` | `write_config` | Throws | Writes pretty JSON. |
| `scanProjects(root)` | `scan_projects` | Throws | Finds direct child folders containing `.project-manager.json`. |
| `detectGithubRepoUrl(projectRoot)` | `detect_github_repo_url` | Returns `null` | Reads local `git remote get-url origin` and normalizes GitHub remotes. |
| `listProjectFiles(root, maxDepth)` | `list_project_files` | Throws | Prunes common build and cache folders. |
| `spawnAgent(opts)` | `spawn_agent` | Calls `/api/bridge/execute` dry run | Returns real PID only in Tauri. |
| `killProcess(pid)` | `kill_process` | No-op | Uses platform kill command. |
| `watchConfig(path)` | `watch_config` | No-op | Rust polls every two seconds. |
| `fetchGithubRepo(token, repoUrl)` | `fetch_github_repo` | Throws | Maps PRs and issues to feature-like rows. |
| `fetchGithubIssues(token, repoUrl)` | `fetch_github_issues` | Throws | Returns raw issue payloads. |
| `startGithubPoll(token, repoUrl, intervalSecs)` | `start_github_poll` | No-op | Emits `github-updated`. |
| `setSecret(service, key, value)` | `set_secret` | Throws | Release: OS Keychain. Debug: `~/.project-manager/dev-secrets.json` (see `PM_DEV_PLAINTEXT_SECRETS`). |
| `getSecret(service, key)` | `get_secret` | Throws | Same backends as `set_secret`; returns `null` when missing. |
| `getSecretsStorageBackend()` | `secrets_storage_backend` | Returns `localStorage` | Label for Keys/Settings UI (`keychain` vs `dev-file`). |
| `callAnthropic(opts)` | `call_anthropic` | Calls `/api/anthropic` | Browser route reads server env; Tauri uses Rust request. |
| `callLlmRouted(opts)` | `call_llm_routed` | Throws | Tauri-only key-blind local router; applies alias fallback and non-sensitive local cooldown state. |
| `listSessions(sessionsDir)` | `list_sessions` | Returns `[]` | Reads JSON sessions. |
| `readSession(sessionsDir, sessionId)` | `read_session` | Throws | Reads a single JSON session. |
| `saveSession(sessionsDir, session)` | `save_session` | No-op | Writes session JSON. |
| `readFile(path)` | `read_file` | Returns empty string | Plain text only. |

## 4. Event Contract

| Event | Payload | Emitted By | Consumer |
| --- | --- | --- | --- |
| `agent-stdout` | `{ pid, line }` | `spawn_agent` stdout task | Runs, logs, sessions UI |
| `agent-stderr` | `{ pid, line }` | `spawn_agent` stderr task | Runs, logs, sessions UI |
| `agent-exit` | `{ pid, code }` | process wait task | Run completion state |
| `config-changed` | `{ path, config }` | `watch_config` poll loop | Project config refresh |
| `github-updated` | `{ repoUrl, features }` | `start_github_poll` | GitHub project refresh |

Event listeners must unsubscribe on component cleanup. In browser mode, event listeners should not be registered unless the caller has already confirmed Tauri mode.

**Tauri subscribe/unsubscribe contract (mandatory for React):**

1. `onAgentStdout` / `onAgentStderr` / `onAgentExit` resolve **asynchronously** — never call the returned `unlisten` in a synchronous `useEffect` cleanup before the promise settles.
2. Use a `cancelled` flag: if the effect cleans up while subscribe is in flight, call `safeUnlisten` on the partial subscription and do not assign handlers to state.
3. Prefer `subscribeAgentProcessEvents` + `safeUnlisten` from `lib/bridge/index.ts` instead of ad-hoc `unlisten?.()` chains.
4. Keep handler bodies in refs when the effect must not re-subscribe on every render (avoids duplicate listeners under React Strict Mode).
5. Never call the same `unlisten` twice — Tauri throws `listeners[eventId].handlerId` and surfaces as the Next.js **N Issues** overlay in dev.

## 5. Safety Notes

`spawn_agent` currently accepts command, args, and working directory from the renderer wrapper. Before broader beta usage, Project Manager needs a formal allowlist and approval policy. Until then:

1. Dispatch UI must show command, args, project root, and dry-run or live status.
2. Browser mode must remain dry-run only.
3. Tauri mode command execution must stay behind explicit user actions.
4. Logs should be preserved when a process fails or is killed.

---

## 中文版本

## 1. Runtime Modes

Project Manager 有兩種執行模式：

| 模式 | 偵測方式 | 用途 | OS Access |
| --- | --- | --- | --- |
| Browser mode | 沒有 `__TAURI_INTERNALS__` | `npm run dev`、browser preview、component testing | 只能透過 Next.js server routes |
| Tauri mode | 有 `__TAURI_INTERNALS__` | Desktop app 與 production behavior | Rust Tauri commands |

Browser mode 不能視為正式 production，只用來讓 UI 開發與測試更快。

## 2. Bridge Discipline

所有 renderer code 都必須呼叫 `lib/bridge/index.ts` 內的 wrapper。Component 不可直接 import `@tauri-apps/api/core`。

原因：

1. Browser fallback 行為集中管理。
2. Tauri command signature 有單一 TypeScript contract。
3. Schema migration 與 secret boundary 可被集中維護。
4. 測試只要 mock 單一 module。

## 3. Command Contract

| Wrapper | Tauri Command | Browser 行為 | 說明 |
| --- | --- | --- | --- |
| `readConfig(path)` | `read_config` | Throws | 輸出會先通過 `migrateConfig()`。 |
| `writeConfig(path, config)` | `write_config` | Throws | 寫入 pretty JSON。 |
| `scanProjects(root)` | `scan_projects` | Throws | 找出直接子資料夾內的 `.project-manager.json`。 |
| `detectGithubRepoUrl(projectRoot)` | `detect_github_repo_url` | 回傳 `null` | 讀取本機 `git remote get-url origin` 並正規化 GitHub remote。 |
| `listProjectFiles(root, maxDepth)` | `list_project_files` | Throws | 排除常見 build 與 cache folders。 |
| `spawnAgent(opts)` | `spawn_agent` | 呼叫 `/api/bridge/execute` dry run | 只有 Tauri 回傳真實 PID。 |
| `killProcess(pid)` | `kill_process` | No-op | 使用平台 kill command。 |
| `watchConfig(path)` | `watch_config` | No-op | Rust 每兩秒輪詢。 |
| `fetchGithubRepo(token, repoUrl)` | `fetch_github_repo` | Throws | 將 PR 與 issue 映射成 feature-like rows。 |
| `fetchGithubIssues(token, repoUrl)` | `fetch_github_issues` | Throws | 回傳 issue payloads。 |
| `startGithubPoll(token, repoUrl, intervalSecs)` | `start_github_poll` | No-op | 發出 `github-updated`。 |
| `setSecret(service, key, value)` | `set_secret` | Throws | Release：OS Keychain。Debug：`~/.project-manager/dev-secrets.json`（見 `PM_DEV_PLAINTEXT_SECRETS`）。 |
| `getSecret(service, key)` | `get_secret` | Throws | 與 `set_secret` 相同 backend；找不到時回傳 `null`。 |
| `getSecretsStorageBackend()` | `secrets_storage_backend` | 回傳 `localStorage` | Keys/Settings UI 用（`keychain` vs `dev-file`）。 |
| `callAnthropic(opts)` | `call_anthropic` | 呼叫 `/api/anthropic` | Browser route 讀 server env；Tauri 走 Rust request。 |
| `callLlmRouted(opts)` | `call_llm_routed` | Throws | 僅 Tauri 使用的 key-blind 本機 router；套用 alias fallback 與非敏感本機 cooldown state。 |
| `listSessions(sessionsDir)` | `list_sessions` | 回傳 `[]` | 讀取 JSON sessions。 |
| `readSession(sessionsDir, sessionId)` | `read_session` | Throws | 讀單一 JSON session。 |
| `saveSession(sessionsDir, session)` | `save_session` | No-op | 寫入 session JSON。 |
| `readFile(path)` | `read_file` | 回傳空字串 | 僅支援 plain text。 |

## 4. Event Contract

| Event | Payload | Emitted By | Consumer |
| --- | --- | --- | --- |
| `agent-stdout` | `{ pid, line }` | `spawn_agent` stdout task | Runs、logs、sessions UI |
| `agent-stderr` | `{ pid, line }` | `spawn_agent` stderr task | Runs、logs、sessions UI |
| `agent-exit` | `{ pid, code }` | process wait task | Run completion state |
| `config-changed` | `{ path, config }` | `watch_config` poll loop | Project config refresh |
| `github-updated` | `{ repoUrl, features }` | `start_github_poll` | GitHub project refresh |

Event listener 必須在 component cleanup 時 unsubscribe。Browser mode 下，除非 caller 已確認 Tauri mode，否則不應註冊 event listeners。

**Tauri 訂閱/退訂契約（React 必填）：**

1. `onAgentStdout` / `onAgentStderr` / `onAgentExit` 為**非同步** resolve — 不可在 promise 完成前於同步 `useEffect` cleanup 呼叫 `unlisten`。
2. 使用 `cancelled` 旗標：若 subscribe 進行中 effect 已卸載，對部分訂閱呼叫 `safeUnlisten`，勿再寫入 state。
3. 優先使用 `subscribeAgentProcessEvents` 與 `safeUnlisten`（`lib/bridge/index.ts`），避免手寫 `unlisten?.()` 鏈。
4. 若 effect 不應因 render 重訂閱，將 handler 放在 ref（避免 React Strict Mode 重複註冊）。
5. 勿對同一 `unlisten` 呼叫兩次 — Tauri 會拋出 `listeners[eventId].handlerId`，開發模式會顯示 Next **N Issues** 紅條。

## 5. Safety Notes

`spawn_agent` 目前接受 renderer wrapper 傳入的 command、args、working directory。擴大 beta 使用前，需要正式 allowlist 與 approval policy。在那之前：

1. Dispatch UI 必須顯示 command、args、project root，以及 dry-run 或 live 狀態。
2. Browser mode 必須維持 dry-run only。
3. Tauri mode command execution 必須由使用者明確動作觸發。
4. 程序失敗或被 kill 時，logs 必須保留。
