# DevPilot Architecture Design

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
[Canonical DevPilot JSON]
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

## 3. Data Alignment Strategy

When upstream inputs change, DevPilot supports:

- Snapshot mode: import and store a local immutable checkpoint.
- Live sync mode: keep external source state in periodic sync.

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
[Canonical DevPilot JSON]
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

## 3. 資料對齊策略

當上游資料來源更新時，DevPilot 支援：

- Snapshot Mode：手動匯入並保存本機快照。
- Live Sync Mode：定期同步外部來源狀態。
