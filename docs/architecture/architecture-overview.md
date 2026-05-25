# Project Manager Architecture Design

---

## English Version

## 1. Data Flow

```
[Source Inputs] (Word, Excel, Markdown, JIRA)
      |
      v
[Ingestion Layer] <--- (AI Mapper / Static Converters)
      |
      v
[Canonical Project Manager JSON]
      |
      v
[Dashboard UI (TanStack Table)]
      |
      v
[Runtime Adapters] ---> (Local IDE / AI Agent CLI)
```

## 2. Core Components

### 2.1 Ingestion Layer

Purpose: normalize inconsistent upstream specification formats.

- Static mapping for structured formats (Excel/CSV).
- AI mapping for unstructured content (Word/PDF/notes).

### 2.2 Runtime Adapters

Purpose: convert UI interactions into executable developer actions.

- IDE adapter launches local editor actions.
- Agent adapter builds prompts and triggers CLI tools.

### 2.3 Local Bridge

Purpose: execute OS-level commands safely outside browser limits.

- Handles process spawn/kill.
- Handles file watch and event streaming.
- Bridges frontend intents to runtime execution.

### 2.4 Current Implementation Map

| Area | Frontend Entry | Bridge Command | Notes |
|---|---|---|---|
| Config read/write | `lib/bridge/index.ts` | `read_config`, `write_config` | Read path runs schema migration before returning to UI. |
| Project scan | `ProjectsView` | `scan_projects`, `list_project_files` | Browser mode shows virtual paths only. |
| Agent execution | `TaskDispatchModal`, `BatchDispatchModal` | `spawn_agent`, `kill_process` | Tauri mode streams stdout, stderr, and exit events. |
| AI calls | `callAnthropic` wrapper | `call_anthropic` | Browser mode uses `/api/anthropic`; shipped Tauri app uses Rust. |
| Secrets | `KeysView`, plugin storage | `set_secret`, `get_secret`, `secrets_storage_backend` | Tauri release: OS Keychain. Tauri debug: `~/.project-manager/dev-secrets.json` (no Keychain prompts). |
| Sessions | `SessionsView` | `list_sessions`, `read_session`, `save_session` | Stored under project `.project-manager/sessions/`. |
| GitHub sync | `ProjectsView`, `MainClient` | `fetch_github_repo`, `fetch_github_issues`, `start_github_poll` | Background poll emits `github-updated`. |

## 3. Data Alignment Strategy

When upstream inputs change, Project Manager supports:

- Snapshot mode: import and store a local immutable checkpoint.
- Live sync mode: keep external source state in periodic sync.

## 4. Document Format Strategy

Project Manager uses a **hybrid format** policy based on the document's role in the workflow:

| Role | Format | Rationale |
|---|---|---|
| Source / editable | `.md` | Token-efficient for AI consumption, clean git diff, low round-trip cost |
| Generated report / review artifact | `.html` | Richer information density — tables, SVG, colour-coded status, interactive elements |

### Markdown paths (source of truth, editable by AI and humans)

`spec`, `tdd`, `tddProgressReport`, `debugRetro`, `testScenarios`, `unitIntegrationTest`, `e2eAcceptanceTestScriptFolder`, `developmentLogSummaryFolder`

### HTML artifact paths (generated, read-only, for human review)

`tddProgressReportHtml` — test-pass rates, coverage heatmap, failure cards  
`devLogSummaryHtml` — timeline, diff comparisons, severity-coloured entries

HTML artifacts are **disposable derivatives** of the source data. They are not committed as source of truth, so noisy diffs are acceptable. When regenerated, the `.html` path in `FeaturePaths` is updated in `.project-manager.json`.

## 5. Engineering Runbooks

Detailed operating notes live under `docs/engineering/`:

- Runtime bridge and command/event contracts: [runtime-bridge.md](../engineering/runtime-bridge.md)
- Storage, schema, and migration rules: [storage-and-schema.md](../engineering/storage-and-schema.md)
- Spec ingestion behavior: [ingestion-pipeline.md](../engineering/ingestion-pipeline.md)
- Secret handling and API boundaries: [security-and-secrets.md](../engineering/security-and-secrets.md)
- Verification and release checks: [verification-runbook.md](../engineering/verification-runbook.md)

---

## 中文版本

## 1. 資料流向

```
[來源資料]（Word、Excel、Markdown、JIRA）
      |
      v
[Ingestion Layer] <---（AI Mapper / Static Converters）
      |
      v
[Canonical Project Manager JSON]
      |
      v
[Dashboard UI（TanStack Table）]
      |
      v
[Runtime Adapters] --->（本地 IDE / AI Agent CLI）
```

## 2. 核心組件

### 2.1 Ingestion Layer（攝取層）

目的：把格式不一致的上游規格統一成可執行資料模型。

- 對結構化格式（Excel/CSV）使用靜態欄位映射。
- 對非結構化內容（Word/PDF/文字描述）使用 AI 映射。

### 2.2 Runtime Adapters（執行適配器）

目的：將 UI 操作轉換成可執行的開發行為。

- IDE Adapter 負責啟動本地編輯器動作。
- Agent Adapter 負責組 Prompt 並觸發 CLI。

### 2.3 Local Bridge（本地橋接層）

目的：在瀏覽器限制之外安全執行 OS 層命令。

- 管理 process 的啟動與終止。
- 管理檔案監聽與事件串流。
- 將前端意圖橋接到 runtime 執行層。

### 2.4 目前實作對照

| 區域 | 前端入口 | Bridge Command | 說明 |
|---|---|---|---|
| 設定讀寫 | `lib/bridge/index.ts` | `read_config`, `write_config` | 讀取後先跑 schema migration 再回 UI。 |
| 專案掃描 | `ProjectsView` | `scan_projects`, `list_project_files` | Browser mode 只顯示虛擬路徑。 |
| Agent 執行 | `TaskDispatchModal`, `BatchDispatchModal` | `spawn_agent`, `kill_process` | Tauri mode 會串流 stdout、stderr 與 exit events。 |
| AI 呼叫 | `callAnthropic` wrapper | `call_anthropic` | Browser mode 走 `/api/anthropic`，正式 Tauri app 走 Rust。 |
| Secrets | `KeysView`, plugin storage | `set_secret`, `get_secret`, `secrets_storage_backend` | Tauri release：OS Keychain。Tauri debug：`~/.project-manager/dev-secrets.json`（免 Keychain 彈窗）。 |
| Sessions | `SessionsView` | `list_sessions`, `read_session`, `save_session` | 存在專案 `.project-manager/sessions/`。 |
| GitHub sync | `ProjectsView`, `MainClient` | `fetch_github_repo`, `fetch_github_issues`, `start_github_poll` | 背景輪詢會發出 `github-updated`。 |

### 2.5 雙模式執行架構（Dual Runtime Mode）

Project Manager 支援兩種執行入口，由 `lib/bridge/index.ts` 的 `isTauri()` 自動偵測：

```
Browser Mode（npm run dev/start）
  前端 JS
    └─ fetch('/api/anthropic')    ← Next.js server route
         └─ process.env.ANTHROPIC_API_KEY → Anthropic API

Tauri App Mode（tauri dev / build）
  前端 JS
    └─ Tauri IPC invoke()
         └─ Rust call_anthropic() → reqwest → Anthropic API
              └─ API key 來自 Rust secret backend（release：Keychain；debug：dev 檔；永遠不進 JS 層）
```

**關鍵差異**：

| 項目 | Browser Mode | Tauri Mode |
|---|---|---|
| AI API Key 位置 | Next.js server env var | Rust secret backend（release：Keychain；debug：dev 檔）|
| Spawn Agent | Dry-run（`/api/bridge/execute`）| 真實子行程（Rust spawn）|
| 適用場景 | 本機開發、E2E 測試 | Production 桌面 app |

> Browser mode 的 Next.js server 必須跑在**使用者本機**，不適合部署到遠端 server 供多人共用（spawn 行為會發生在 server 機器上，不是使用者機器）。

## 3. 資料對齊策略

當上游資料來源更新時，Project Manager 支援：

- Snapshot Mode：手動匯入並保存本機快照。
- Live Sync Mode：定期同步外部來源狀態。

## 4. 文件格式策略（Document Format Strategy）

Project Manager 採用**混合格式**原則，依文件在工作流中的角色決定格式：

| 角色 | 格式 | 原因 |
|---|---|---|
| 來源 / 可編輯 | `.md` | AI 讀取 token 效率高、git diff 乾淨、人機協作修改成本低 |
| 生成報告 / 審閱產物 | `.html` | 資訊密度更高：表格、SVG、色標狀態、互動元件 |

### Markdown 路徑（來源真相，AI 與人類均可編輯）

`spec`、`tdd`、`tddProgressReport`、`debugRetro`、`testScenarios`、`unitIntegrationTest`、`e2eAcceptanceTestScriptFolder`、`developmentLogSummaryFolder`

### HTML 產物路徑（生成、唯讀、供人工審閱）

`tddProgressReportHtml` — 測試通過率、覆蓋率熱圖、失敗原因卡片  
`devLogSummaryHtml` — 時間軸、diff 對照、嚴重程度色標

HTML 產物是來源資料的**可拋棄衍生物**，不作為來源真相提交。重新生成時，`.project-manager.json` 內的對應 HTML 路徑欄位會被更新。

## 5. 工程 Runbooks

細節操作文件放在 `docs/engineering/`：

- Runtime bridge 與 command/event contract：[runtime-bridge.md](../engineering/runtime-bridge.md)
- Storage、schema 與 migration 規則：[storage-and-schema.md](../engineering/storage-and-schema.md)
- 規格攝取行為：[ingestion-pipeline.md](../engineering/ingestion-pipeline.md)
- Secret handling 與 API 邊界：[security-and-secrets.md](../engineering/security-and-secrets.md)
- 驗證與 release checks：[verification-runbook.md](../engineering/verification-runbook.md)
