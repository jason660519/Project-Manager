# Storage and Schema

> Status: Active  
> Last updated: 2026-05-15  
> Primary files: `lib/storage/*`, `lib/types/index.ts`, `schema/dev-pilot.schema.json`, `config/samples/*`

---

## English Version

## 1. Source of Truth

DevPilot uses project-scoped `.dev-pilot.json` documents as the long-term source of truth. UI state and imported project lists can be cached locally, but the project config format is owned by:

1. `lib/types/index.ts`
2. `schema/dev-pilot.schema.json`
3. `lib/storage/migrate.ts`
4. Sample configs under `config/samples/`

Any schema change must update all four.

## 2. Schema Version

Current schema version: `2`.

Schema v2 adds:

| Scope | Field | Purpose |
| --- | --- | --- |
| Root | `id` | Stable project config identity, required. |
| Root | `createdAt` | Creation timestamp. |
| Root | `updatedAt` | Last modification timestamp. |
| Root | `updatedBy` | Reserved editor identity. |
| Feature | `createdAt` | Feature creation timestamp. |
| Feature | `updatedAt` | Feature modification timestamp. |
| Feature | `updatedBy` | Reserved editor identity. |

The decision is recorded in [ADR-006](../architecture/ADR-006-schema-v2-sync-fields.md).

## 3. Migration Pipeline

`migrateConfig(raw)` is the only supported migration entry point. It is pure and idempotent.

Current call sites:

| Call Site | Why |
| --- | --- |
| `readConfig()` in `lib/bridge/index.ts` | Any config read from disk is upgraded before UI sees it. |
| `LocalStorageProjectsRepository.listProjects()` | Cached project entries from old sessions are upgraded. |
| Project creation and import flows | User-supplied JSON is normalized before persistence. |

Migration rules:

1. Treat missing `schemaVersion` as v1.
2. Generate `id` if absent.
3. Back-fill missing root and feature timestamps.
4. Do not rewrite unrelated fields.
5. Do not create fake product data.

## 4. Storage Namespaces

Local browser storage is split by future sync intent:

| Namespace | Meaning | Examples |
| --- | --- | --- |
| `devpilot.shared.*` | Data that may eventually sync | project list, plugin catalog |
| `devpilot.personal.*` | Per-user local preferences | selected project, dashboard project IDs, dev-mode key fallback |

The current project repository implementation is `LocalStorageProjectsRepository`. It implements the async `ProjectsRepository` interface so SQLite, Tauri storage, or cloud sync can replace it without changing consumers.

## 5. Session Storage

Tauri sessions are stored under the project root:

```text
.dev-pilot/
└── sessions/
    └── {sessionId}.json
```

`call_anthropic` can auto-save a completed session when `sessionId` and `sessionsDir` are provided. Browser mode does not persist sessions through the bridge.

## 6. Change Checklist

Before changing schema or storage:

1. Update `lib/types/index.ts`.
2. Update `schema/dev-pilot.schema.json`.
3. Update `lib/storage/migrate.ts`.
4. Update sample configs.
5. Add or update tests for migration and repository behavior.
6. Update this document and add an ADR for breaking or strategic changes.

---

## 中文版本

## 1. Source of Truth

DevPilot 以專案內的 `.dev-pilot.json` 作為長期 source of truth。UI state 與 imported project list 可以在本機快取，但 project config format 由以下檔案共同定義：

1. `lib/types/index.ts`
2. `schema/dev-pilot.schema.json`
3. `lib/storage/migrate.ts`
4. `config/samples/` 內的 sample configs

任何 schema change 都必須同步更新四處。

## 2. Schema Version

目前 schema version：`2`。

Schema v2 新增：

| 範圍 | 欄位 | 用途 |
| --- | --- | --- |
| Root | `id` | 穩定 project config identity，必填。 |
| Root | `createdAt` | 建立時間。 |
| Root | `updatedAt` | 最後修改時間。 |
| Root | `updatedBy` | 預留 editor identity。 |
| Feature | `createdAt` | Feature 建立時間。 |
| Feature | `updatedAt` | Feature 修改時間。 |
| Feature | `updatedBy` | 預留 editor identity。 |

決策記錄在 [ADR-006](../architecture/ADR-006-schema-v2-sync-fields.md)。

## 3. Migration Pipeline

`migrateConfig(raw)` 是唯一支援的 migration entry point。它是 pure 且 idempotent。

目前 call sites：

| Call Site | 原因 |
| --- | --- |
| `lib/bridge/index.ts` 的 `readConfig()` | 從 disk 讀出的 config 在進 UI 前先升級。 |
| `LocalStorageProjectsRepository.listProjects()` | 舊 session cached project entries 會被升級。 |
| Project creation 與 import flows | 使用者輸入的 JSON 在 persistence 前先 normalize。 |

Migration rules：

1. 缺少 `schemaVersion` 時視為 v1。
2. 缺少 `id` 時自動產生。
3. 補上缺少的 root 與 feature timestamps。
4. 不重寫無關欄位。
5. 不產生假的產品資料。

## 4. Storage Namespaces

Local browser storage 依未來 sync 意圖拆分：

| Namespace | 意義 | 範例 |
| --- | --- | --- |
| `devpilot.shared.*` | 未來可能同步的資料 | project list、plugin catalog |
| `devpilot.personal.*` | 每位使用者本機偏好 | selected project、dashboard project IDs、dev-mode key fallback |

目前 project repository implementation 是 `LocalStorageProjectsRepository`。它實作 async `ProjectsRepository` interface，讓未來 SQLite、Tauri storage 或 cloud sync 可以替換，不用改 consumers。

## 5. Session Storage

Tauri sessions 存在 project root 底下：

```text
.dev-pilot/
└── sessions/
    └── {sessionId}.json
```

當 caller 提供 `sessionId` 與 `sessionsDir` 時，`call_anthropic` 可以自動保存 completed session。Browser mode 不透過 bridge persist sessions。

## 6. Change Checklist

變更 schema 或 storage 前：

1. 更新 `lib/types/index.ts`。
2. 更新 `schema/dev-pilot.schema.json`。
3. 更新 `lib/storage/migrate.ts`。
4. 更新 sample configs。
5. 新增或更新 migration 與 repository behavior tests。
6. 更新本文件；若是 breaking 或 strategic change，新增 ADR。
