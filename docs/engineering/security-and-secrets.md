# Security and Secrets

> Status: Active  
> Last updated: 2026-05-15  
> Primary files: `lib/bridge/index.ts`, `lib/storage/plugins.ts`, `app/ui/views/KeysView.tsx`, `src-tauri/src/lib.rs`, `app/api/anthropic/route.ts`

---

## English Version

## 1. Boundary

DevPilot is local-first, but it can execute local commands and call external APIs. Security documentation must focus on two boundaries:

1. Secrets must not be written to plaintext production storage.
2. Local command execution must remain visible and user-controlled.

## 2. Secret Storage

| Secret | Tauri Mode | Browser Development Mode | Notes |
| --- | --- | --- | --- |
| Provider API keys | OS Keychain through `set_secret` and `get_secret` | `localStorage` fallback | Dev fallback only; not production. |
| GitHub token | OS Keychain service `devpilot`, key `github-token` | `localStorage` fallback | Used by GitHub import and polling. |
| Anthropic API key for `/api/anthropic` | Not used by shipped Tauri path | Server environment variable | Browser development server only. |

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
| P2 | Document platform-specific Keychain behavior. | This document |
| P2 | Add token deletion semantics for all secret rows. | This document |

---

## 中文版本

## 1. Boundary

DevPilot 是 local-first，但它可以執行本機 command，也可以呼叫外部 API。Security 文件必須聚焦兩條邊界：

1. Secrets 不可寫入 production plaintext storage。
2. Local command execution 必須可見且由使用者控制。

## 2. Secret Storage

| Secret | Tauri Mode | Browser Development Mode | 說明 |
| --- | --- | --- | --- |
| Provider API keys | 透過 `set_secret` 與 `get_secret` 存 OS Keychain | `localStorage` fallback | 僅供 dev fallback，不是 production。 |
| GitHub token | OS Keychain service `devpilot`，key `github-token` | `localStorage` fallback | GitHub import 與 polling 使用。 |
| `/api/anthropic` 的 Anthropic API key | Shipped Tauri path 不使用 | Server environment variable | 僅限 browser development server。 |

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
| P2 | 補 platform-specific Keychain behavior。 | 本文件 |
| P2 | 補所有 secret rows 的 token deletion semantics。 | 本文件 |
