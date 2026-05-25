# Security and Secrets

> Status: Active  
> Last updated: 2026-05-26
> Primary files: `lib/bridge/index.ts`, `lib/storage/plugins.ts`, `app/ui/views/KeysView.tsx`, `src-tauri/src/lib.rs`, `src-tauri/src/dev_secrets.rs`, `app/api/anthropic/route.ts`

---

## English Version

## 1. Boundary

Project Manager is local-first, but it can execute local commands and call external APIs. Security documentation must focus on two boundaries:

1. Secrets must not be written to plaintext production storage.
2. Local command execution must remain visible and user-controlled.

## 2. Secret Storage

| Secret | Tauri release build | Tauri debug build (`tauri dev`) | Browser development mode | Notes |
| --- | --- | --- | --- | --- |
| Provider API keys | OS Keychain via `set_secret` / `get_secret` | `~/.project-manager/dev-secrets.json` (launcher and `npm run tauri:dev` default) | `localStorage` | Debug file avoids macOS Keychain prompts on unsigned rebuilds. Override with `PM_DEV_PLAINTEXT_SECRETS`; `npm run tauri:build` refuses `PM_DEV_PLAINTEXT_SECRETS=1`. |
| GitHub token | OS Keychain `projectmanager` / `github-token` | Same dev file as above | `localStorage` | Used by GitHub import and polling. |
| Anthropic API key for `/api/anthropic` | Not used by shipped Tauri path | Not used | Server environment variable | Browser development server only. |

**Engineer notice:** see [`.project-manager/dev-logs/dev-keychain-bypass-2026-05-20.md`](../../.project-manager/dev-logs/dev-keychain-bypass-2026-05-20.md) for migration steps (re-save keys once after switching backends). Keys UI and Settings show the active backend via `secrets_storage_backend`. Use `npm run tauri:dev:keychain` only when intentionally testing macOS Keychain behavior.

UI must show configured or missing state, not raw secret values.

## 3. API Call Boundary

Tauri mode:

```text
Renderer -> callAnthropic wrapper -> Tauri invoke -> Rust reqwest -> provider API
```

Browser development mode:

```text
Renderer -> /api/anthropic -> Next.js server route -> provider API
```

The browser route exists only for local development. Anything needed in the shipped app belongs in Rust.

## 4. Command Execution Boundary

Current `spawn_agent` behavior:

1. Renderer wrapper sends command, args, and working directory.
2. Rust starts the child process.
3. Rust emits stdout, stderr, and exit events.
4. UI tracks active and completed runs.

Required UX:

1. Show command and working directory before live execution.
2. Distinguish dry-run from live execution.
3. Preserve logs after failure or kill.
4. Keep kill or cancel available while running.

## 5. Open Security Work

| Priority | Work | Owner Document |
| --- | --- | --- |
| P1 | Define command allowlist and approval policy. | [runtime-bridge.md](./runtime-bridge.md) and new ADR |
| P1 | Add audit trail for live command dispatches. | [storage-and-schema.md](./storage-and-schema.md) |
| P2 | Document platform-specific Keychain behavior. | This document (debug dev-file path documented 2026-05-20) |
| P2 | Add token deletion semantics for all secret rows. | This document |

---

## 中文版本

## 1. Boundary

Project Manager 是 local-first，但它可以執行本機 command，也可以呼叫外部 API。Security 文件必須聚焦兩條邊界：

1. Secrets 不可寫入 production plaintext storage。
2. Local command execution 必須可見且由使用者控制。

## 2. Secret Storage

| Secret | Tauri release 建置 | Tauri debug 建置（`tauri dev`） | Browser 開發模式 | 說明 |
| --- | --- | --- | --- | --- |
| Provider API keys | OS Keychain（`set_secret` / `get_secret`） | launcher 與 `npm run tauri:dev` 預設 `~/.project-manager/dev-secrets.json` | `localStorage` | Debug 檔避免 unsigned rebuild 反覆跳出 Keychain。可用 `PM_DEV_PLAINTEXT_SECRETS` 覆寫；`npm run tauri:build` 會拒絕 `PM_DEV_PLAINTEXT_SECRETS=1`。 |
| GitHub token | OS Keychain `projectmanager` / `github-token` | 同上 dev 檔 | `localStorage` | GitHub import 與 polling 使用。 |
| `/api/anthropic` 的 Anthropic API key | Shipped Tauri path 不使用 | 不使用 | Server environment variable | 僅限 browser development server。 |

**工程師提醒：** 見 [`.project-manager/dev-logs/dev-keychain-bypass-2026-05-20.md`](../../.project-manager/dev-logs/dev-keychain-bypass-2026-05-20.md)（切換 backend 後請到 Keys 重新 Save 一次）。Keys / Settings 會透過 `secrets_storage_backend` 顯示目前 backend。只有刻意測試 macOS Keychain 行為時才使用 `npm run tauri:dev:keychain`。

UI 必須顯示 configured 或 missing state，不顯示 raw secret values。

## 3. API Call Boundary

Tauri mode:

```text
Renderer -> callAnthropic wrapper -> Tauri invoke -> Rust reqwest -> provider API
```

Browser development mode:

```text
Renderer -> /api/anthropic -> Next.js server route -> provider API
```

Browser route 只為本機開發存在。正式 shipped app 需要的能力必須放在 Rust。

## 4. Command Execution Boundary

目前 `spawn_agent` 行為：

1. Renderer wrapper 傳 command、args、working directory。
2. Rust 啟動 child process。
3. Rust 發出 stdout、stderr、exit events。
4. UI 追蹤 active 與 completed runs。

必要 UX：

1. Live execution 前顯示 command 與 working directory。
2. 明確區分 dry-run 與 live execution。
3. Failure 或 kill 後保留 logs。
4. Running 時保留 kill 或 cancel。

## 5. Open Security Work

| 優先級 | 工作 | 負責文件 |
| --- | --- | --- |
| P1 | 定義 command allowlist 與 approval policy。 | [runtime-bridge.md](./runtime-bridge.md) 與新 ADR |
| P1 | 為 live command dispatches 增加 audit trail。 | [storage-and-schema.md](./storage-and-schema.md) |
| P2 | 補 platform-specific Keychain behavior。 | 本文件（debug dev-file 路徑已於 2026-05-20 補充） |
| P2 | 補所有 secret rows 的 token deletion semantics。 | 本文件 |
