# Storage and Schema

> Status: Active
> Last updated: 2026-05-19
> Primary files: `lib/storage/*`, `lib/types/index.ts`, `schema/project-manager.schema.json`, `config/samples/*`

---

## English Version

## 1. Source of Truth

Project Manager uses project-scoped `.project-manager/config.json` documents as the long-term source of truth. UI state and imported project lists can be cached locally, but the project config format is owned by:

1. `lib/types/index.ts`
2. `schema/project-manager.schema.json`
3. `lib/storage/migrate.ts`
4. Sample configs under `config/samples/`

Any schema change must update all four.

## 2. Project Manifest and Progress Sheets

F55 keeps `.project-manager/config.json` as the project manifest and index. The
manifest owns project identity, metadata, adapters, roles, cron jobs, backend
profile selection, and references to one or more progress sheets. It must not
become the single container for every discipline-specific progress column.

Progress sheet contracts live in per-sheet config files:

```text
.project-manager/
├── config.json
└── progress-sheets/
    ├── software-desktop-app/
    │   └── config.json
    ├── hardware-rd/
    │   └── config.json
    └── qa-validation/
        └── config.json
```

Planned manifest sheet references use relative paths:

```ts
interface ProjectProgressSheetRef {
  id: string;
  label: string;
  discipline: string;
  configPath: string; // ".project-manager/progress-sheets/<sheetId>/config.json"
  templateId: string;
  templateVersion: number;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Each sheet config owns its own template snapshot, column definitions,
status/phase options, rows or row sidecar pointers, archived fields, and
migration metadata. System templates are copied into a sheet as snapshots;
template updates must not silently mutate existing project data.

## 3. Backend Profiles

Project Manager supports these backend modes:

| Mode | Storage / control plane | Requirements |
| --- | --- | --- |
| `local-files` | `.project-manager/` files through the Tauri bridge | No Docker, sign-in, or network backend required. |
| `local-docker-supabase` | Local Supabase-compatible Docker stack | Used for personal, PoC, restricted-network, or local team collaboration. |
| `self-hosted-supabase` | Company-owned Supabase-compatible backend | Uses organization-managed infrastructure and policies. |
| `supabase-cloud` | Managed Supabase Cloud project | Used for SaaS collaboration when teams do not operate the backend. |

Renderer-safe profile data may include profile ID, label, mode, URL, and anon
key reference/value. Service-role keys, JWT secrets, and database passwords are
ops-only secrets and must not enter renderer code.

## 4. Schema Version

Current schema version: `11`.

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

Schema v5 separates README file pointers from free-form notes:

| Scope | Field | Purpose |
| --- | --- | --- |
| Feature | `readmePath` | Relative path to the feature overview README. |
| Feature | `notes` | Short human-authored summary or note; never a file path. |

Migration v5 moves legacy README paths out of `notes` and removes README paths that were incorrectly stored in `paths.spec`.

Schema v11 adds project-manifest progress sheet references and renderer-safe
backend profiles:

| Scope | Field | Purpose |
| --- | --- | --- |
| Root | `progressSheets` | Index of per-discipline progress sheet configs under `.project-manager/progress-sheets/<sheetId>/config.json`. |
| Root | `backendProfiles` | Renderer-safe backend connector profiles. |
| Root | `activeBackendProfileMode` | Selected backend mode: `local-files`, `local-docker-supabase`, `self-hosted-supabase`, or `supabase-cloud`. |

Migration v11 adds a `software-desktop-app` sheet ref for existing software
projects without deleting or rewriting `features[]`.

## 5. Migration Pipeline

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

## 6. Storage Namespaces

Local browser storage is split by future sync intent:

| Namespace | Meaning | Examples |
| --- | --- | --- |
| `projectManager.shared.*` | Data that may eventually sync | project list, plugin catalog |
| `projectManager.personal.*` | Per-user local preferences | selected project, dashboard project IDs, dev-mode key fallback |

The current project repository implementation is `LocalStorageProjectsRepository`. It implements the async `ProjectsRepository` interface so SQLite, Tauri storage, or cloud sync can replace it without changing consumers.

## 7. Session Storage

Tauri sessions are stored under the project root:

```text
.project-manager/
└── sessions/
    └── {sessionId}.json
```

`call_anthropic` can auto-save a completed session when `sessionId` and `sessionsDir` are provided. Browser mode does not persist sessions through the bridge.

## 8. Change Checklist

Before changing schema or storage:

1. Update `lib/types/index.ts`.
2. Update `schema/project-manager.schema.json`.
3. Update `lib/storage/migrate.ts`.
4. Update sample configs.
5. Add or update tests for migration and repository behavior.
6. Update this document and add an ADR for breaking or strategic changes.

---

## 中文版本

## 1. Source of Truth

Project Manager 以專案內的 `.project-manager/config.json` 作為長期 source of truth。UI state 與 imported project list 可以在本機快取，但 project config format 由以下檔案共同定義：

1. `lib/types/index.ts`
2. `schema/project-manager.schema.json`
3. `lib/storage/migrate.ts`
4. `config/samples/` 內的 sample configs

任何 schema change 都必須同步更新四處。

## 2. Project Manifest and Progress Sheets

F55 會保留 `.project-manager/config.json` 作為 project manifest 與 index。
Manifest 負責 project identity、metadata、adapters、roles、cron jobs、
backend profile selection，以及一個或多個 progress sheets 的 references。
它不應該變成所有 discipline-specific progress columns 的唯一容器。

Progress sheet contracts 會放在每個 sheet 自己的 config file：

```text
.project-manager/
├── config.json
└── progress-sheets/
    ├── software-desktop-app/
    │   └── config.json
    ├── hardware-rd/
    │   └── config.json
    └── qa-validation/
        └── config.json
```

Planned manifest sheet references 使用 relative paths：

```ts
interface ProjectProgressSheetRef {
  id: string;
  label: string;
  discipline: string;
  configPath: string; // ".project-manager/progress-sheets/<sheetId>/config.json"
  templateId: string;
  templateVersion: number;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

每個 sheet config 擁有自己的 template snapshot、column definitions、
status/phase options、rows 或 row sidecar pointers、archived fields，以及
migration metadata。System templates 會以 snapshot 形式複製到 sheet；template
更新不可默默改動既有 project data。

## 3. Backend Profiles

Project Manager 支援以下 backend modes：

| Mode | Storage / control plane | Requirements |
| --- | --- | --- |
| `local-files` | 透過 Tauri bridge 寫入 `.project-manager/` files | 不需要 Docker、sign-in 或 network backend。 |
| `local-docker-supabase` | 本機 Supabase-compatible Docker stack | 用於 personal、PoC、restricted-network 或 local team collaboration。 |
| `self-hosted-supabase` | 公司自管 Supabase-compatible backend | 使用組織管理的 infrastructure 與 policies。 |
| `supabase-cloud` | Managed Supabase Cloud project | 團隊不自行營運 backend 時用於 SaaS collaboration。 |

Renderer-safe profile data 可以包含 profile ID、label、mode、URL，以及 anon
key reference/value。Service-role keys、JWT secrets、database passwords 屬於
ops-only secrets，不可進入 renderer code。

## 4. Schema Version

目前 schema version：`11`。

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

Schema v5 將 README 檔案指標與自由文字 notes 拆開：

| 範圍 | 欄位 | 用途 |
| --- | --- | --- |
| Feature | `readmePath` | 指向 feature overview README 的相對路徑。 |
| Feature | `notes` | 短文字摘要或人工備註；不可存檔案路徑。 |

v5 migration 會把舊 `notes` 內的 README path 搬到 `readmePath`，並移除誤放在 `paths.spec` 的 README path。

Schema v11 新增 project-manifest progress sheet references 與 renderer-safe
backend profiles：

| 範圍 | 欄位 | 用途 |
| --- | --- | --- |
| Root | `progressSheets` | 指向 `.project-manager/progress-sheets/<sheetId>/config.json` 的多工種 progress sheet index。 |
| Root | `backendProfiles` | Renderer-safe backend connector profiles。 |
| Root | `activeBackendProfileMode` | 目前選擇的 backend mode：`local-files`、`local-docker-supabase`、`self-hosted-supabase` 或 `supabase-cloud`。 |

v11 migration 會為既有 software project 加上 `software-desktop-app` sheet ref，
但不刪除或重寫 `features[]`。

## 5. Migration Pipeline

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

## 6. Storage Namespaces

Local browser storage 依未來 sync 意圖拆分：

| Namespace | 意義 | 範例 |
| --- | --- | --- |
| `projectManager.shared.*` | 未來可能同步的資料 | project list、plugin catalog |
| `projectManager.personal.*` | 每位使用者本機偏好 | selected project、dashboard project IDs、dev-mode key fallback |

目前 project repository implementation 是 `LocalStorageProjectsRepository`。它實作 async `ProjectsRepository` interface，讓未來 SQLite、Tauri storage 或 cloud sync 可以替換，不用改 consumers。

## 7. Session Storage

Tauri sessions 存在 project root 底下：

```text
.project-manager/
└── sessions/
    └── {sessionId}.json
```

當 caller 提供 `sessionId` 與 `sessionsDir` 時，`call_anthropic` 可以自動保存 completed session。Browser mode 不透過 bridge persist sessions。

## 8. Change Checklist

變更 schema 或 storage 前：

1. 更新 `lib/types/index.ts`。
2. 更新 `schema/project-manager.schema.json`。
3. 更新 `lib/storage/migrate.ts`。
4. 更新 sample configs。
5. 新增或更新 migration 與 repository behavior tests。
6. 更新本文件；若是 breaking 或 strategic change，新增 ADR。
