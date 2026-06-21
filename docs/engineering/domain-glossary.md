# Project Manager Domain Glossary

> Status: Active  
> Owner: Project Manager engineering  
> Last updated: 2026-06-21  
> Classification: internal  
> Related: [storage-and-schema.md](./storage-and-schema.md), [supabase-db-design-standard.md](./supabase-db-design-standard.md), [supabase-cloud-auth.md](./supabase-cloud-auth.md), [ADR-016](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md)

---

## English Version

## 1. Purpose

This glossary defines **Project Manager product and engineering terms** used across docs, code, and AI agent instructions.

It is a **navigation aid**, not a replacement for deeper contracts. When a term has a formal SSOT elsewhere, this file points to that source.

## 2. Meta Terms

| Term | Definition | SSOT / pointer |
| --- | --- | --- |
| **SSOT** (Single Source of Truth) | The one canonical place where a fact, schema, or contract is defined. Other docs and code should reference the SSOT instead of copying conflicting definitions. | This glossary for vocabulary; see per-term SSOT column below. |
| **Dual-storage model** | Cloud Postgres holds collaboration state; `.project-manager/` and Git hold engineering artifacts. Neither fully replaces the other during migration. | [ADR-016 § Data Ownership](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md#data-ownership) |
| **Backend profile mode** | Which storage/control plane the app uses: `local-files`, `local-docker-supabase`, `self-hosted-supabase`, or `supabase-cloud`. | [storage-and-schema.md §3](./storage-and-schema.md) |
| **Control plane** | Services that own identity, workspace permissions, and collaborative product state (Supabase-compatible Auth + Postgres when not in `local-files`). | [ADR-016](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md) |

## 3. Identity and Access

| Term | Definition | SSOT / pointer |
| --- | --- | --- |
| **User** | A person identified by Supabase Auth (`auth.users.id`). Not the same as a local-only desktop session with no cloud backend. | Supabase Auth; `lib/auth/supabaseAuthSession.ts` |
| **`auth.uid()`** | Postgres function returning the current signed-in user's UUID, or `null` when unauthenticated. Used in RLS policies. | `infra/supabase/migrations/0001_pm_core.sql` |
| **Workspace** | Cloud **tenant boundary** for collaboration: a named container for memberships, roles, cloud projects, runs, reports, and audit history. Table: `public.workspaces`. | `0001_pm_core.sql`; [supabase-cloud-auth.md §5](./supabase-cloud-auth.md) |
| **Workspace membership** | Join row linking one Supabase user to one workspace with a **workspace role**. Table: `public.workspace_memberships`. | `0001_pm_core.sql`; `lib/auth/workspaceMemberships.ts` |
| **Workspace role** (`WorkspaceRole`) | Permission label on a membership: `owner`, `admin`, `developer`, `reviewer`, `viewer`, or `user`. Distinct from local **EngineerRole**. | `lib/auth/permissions.ts`; DB check on `workspace_memberships.role` |
| **Capability** | Fine-grained permission flag (e.g. `view:developer-console`, `members:manage`) derived from workspace role in client route guards. | `lib/auth/permissions.ts` |
| **RLS** (Row Level Security) | Postgres policy layer that restricts which rows the anon/authenticated client may read or write, typically scoped by `workspace_id` and `auth.uid()`. | [supabase-db-design-standard.md §9](./supabase-db-design-standard.md) |
| **Anon key** | Public Supabase API key safe in browser code **only when RLS is correct**. | [supabase-cloud-auth.md §2](./supabase-cloud-auth.md) |
| **Service-role key** | Privileged Supabase key that bypasses RLS. Must never ship in renderer, static export, or fixtures. | [supabase-db-design-standard.md §4](./supabase-db-design-standard.md) |

### 3.1 Workspace roles (summary)

| Role | Default route | Typical audience |
| --- | --- | --- |
| `owner`, `admin` | `/admin` | Workspace operators |
| `developer` | `/developer` | Engineers with local runner access |
| `reviewer` | `/portal` | Review-only stakeholders |
| `viewer`, `user` | `/portal` | General users (read-only portal) |

Full capability matrix: `lib/auth/permissions.ts` (`ROLE_CAPABILITIES`).

## 4. Project — Two Meanings

| Term | Definition | SSOT / pointer |
| --- | --- | --- |
| **Local project** | A folder on disk that contains `.project-manager/config.json` (the project manifest). Owns features, progress sheets, adapters, and local engineering state. | [storage-and-schema.md §1–§2](./storage-and-schema.md); `lib/types/index.ts`; `schema/project-manager.schema.json` |
| **Cloud project** | A metadata row in Postgres scoped to a workspace: name, solution URL, links to portal views. Table: `public.projects`. | `0001_pm_core.sql`; `lib/auth/portalProjects.ts` |
| **Project manifest** | The file `.project-manager/config.json` — long-term SSOT for local project identity and configuration. | [storage-and-schema.md §1](./storage-and-schema.md) |

**Do not conflate** local project and cloud project. They may refer to the same real-world effort but are stored in different owners until sync/writeback contracts are complete.

## 5. Features, Artifacts, and Progress

| Term | Definition | SSOT / pointer |
| --- | --- | --- |
| **Feature (local)** | A tracked work item in the local project manifest (`Feature` in config), with paths to specs, TDD, dev logs, and dashboard progress. IDs like `F47`. | `lib/types/index.ts`; `.project-manager/features/<ID>/` |
| **Feature (cloud)** | Collaborative feature/task metadata in Postgres (`public.features`): status, progress percent, pointers — not the full spec body. | `lib/supabase/cloudSchema.ts`; migration `0002_features_audit_logs.sql` |
| **Feature artifact** | Human-authored docs under `.project-manager/features/<ID>/` (`README.md`, `feature-spec.md`, `tdd-spec.md`, etc.). | [file-naming-standards.md §4](../file-naming-standards.md) |
| **Progress sheet** | Discipline-specific progress table config under `.project-manager/progress-sheets/<sheetId>/config.json`. | [storage-and-schema.md §2](./storage-and-schema.md) |
| **Schema version** | Integer in local config (`schemaVersion`) bumped on breaking manifest changes. Current: see [storage-and-schema.md §4](./storage-and-schema.md). | `lib/storage/migrate.ts`; ADR-002 |

## 6. Roles — Do Not Confuse

| Term | Definition | SSOT / pointer |
| --- | --- | --- |
| **Workspace role** | Cloud permission on `workspace_memberships.role`. Controls `/login`, `/portal`, `/developer`, `/admin`. | §3 above |
| **EngineerRole** | Local AI/engineering persona in the desktop app: skills, system prompt, model defaults, capabilities. Used for dispatch, not cloud route guards. | `lib/types/index.ts` (`EngineerRole`); `app/engineers/` |
| **Harness task role** | Planner / worker / evaluator assignment on a local feature harness — orchestration slice, not workspace RBAC. | `lib/types/index.ts` (`HarnessTaskRole`) |

## 7. Surfaces and Runners

| Term | Definition | SSOT / pointer |
| --- | --- | --- |
| **User Portal** | Route `/portal` for progress, reports, and solution links without local execution. Capability: `view:portal`. | `app/portal/`; [supabase-cloud-auth.md §8](./supabase-cloud-auth.md) |
| **Developer Console** | Route `/developer` for runners, agent runs, sync cursors. Capability: `view:developer-console`. | `app/developer/` |
| **Admin Console** | Route `/admin` for members, roles, audit logs. Capability: `view:admin-console`. | `app/admin/` |
| **Developer Runner** | Rust/Tauri local execution layer: repo access, process spawn, OS Keychain, runner pairing. Not the cloud CRUD backend. | [ADR-016](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md) |
| **Runner device** | Cloud registry row for a paired machine (`public.runner_devices`): `runner_id`, status, approved project root. | `0003_runner_devices.sql`; `lib/auth/runnerDevices.ts` |
| **Runner state** | Client-side readiness: `missing`, `paired_offline`, `project_blocked`, `ready`, `error`. Only `ready` allows dispatch. | `lib/auth/runnerStatus.ts` |
| **Agent run** | Cloud metadata for a dispatched or queued execution (`public.agent_runs`). Raw logs live outside Postgres. | `0001_pm_core.sql`; `lib/auth/agentRuns.ts` |
| **Bridge** | Typed Tauri IPC boundary: components call `lib/bridge/index.ts`, never raw `invoke()`. | [runtime-bridge.md](./runtime-bridge.md); `AGENTS.md` Iron Rules |

## 8. Cloud Metadata Tables (short)

| Term | Table | Holds |
| --- | --- | --- |
| **Report metadata** | `report_metadata` | Portal index for reports (title, status, URL) — not report body |
| **Sync cursor** | `sync_cursors` | Local/cloud revision pointers for future writeback |
| **Audit log** | `audit_logs` | Membership changes, runner pairing, privileged actions |
| **Workspace invite** | `workspace_invites` | Pending email invites (accept on `/login`) |

Row shapes: `lib/supabase/cloudSchema.ts`. RLS inventory: `lib/supabase/rlsContracts.ts`.

## 9. Maintenance Rule

When introducing a **new product noun** used in more than one doc or module:

1. Add it here with English definition and SSOT pointer.
2. Add the Chinese equivalent in §中文版本 below.
3. Link from the owning runbook instead of redefining the term inline.

---

## 中文版本

## 1. 目的

本辭典定義 Project Manager 在文件、程式碼與 AI agent 指令中使用的**產品與工程術語**。

它是**導覽索引**，不取代各主題的正式 contract。若術語已有 SSOT，本文件只給定義摘要並指向該來源。

## 2. 元術語

| 術語 | 定義 | SSOT / 指標 |
| --- | --- | --- |
| **SSOT**（Single Source of Truth，單一可信來源） | 某項事實、schema 或 contract 的**唯一權威定義處**。其他文件與程式應引用 SSOT，而非複製可能衝突的定義。 | 詞彙見本辭典；各術語見下方 SSOT 欄 |
| **Dual-storage model（雙儲存模型）** | 雲端 Postgres 存協作狀態；`.project-manager/` 與 Git 存工程 artifact。遷移期間兩者互不完整取代。 | [ADR-016 § Data Ownership](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md#data-ownership) |
| **Backend profile mode（後端設定模式）** | App 使用的儲存/控制平面：`local-files`、`local-docker-supabase`、`self-hosted-supabase`、`supabase-cloud`。 | [storage-and-schema.md §3](./storage-and-schema.md) |
| **Control plane（控制平面）** | 負責身分、工作區權限與協作產品狀態的服務（非 `local-files` 時為 Supabase-compatible Auth + Postgres）。 | [ADR-016](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md) |

## 3. 身分與存取

| 術語 | 定義 | SSOT / 指標 |
| --- | --- | --- |
| **User（使用者）** | 由 Supabase Auth 識別的人（`auth.users.id`）。不同於僅用桌面、未接雲端 backend 的本機 session。 | Supabase Auth；`lib/auth/supabaseAuthSession.ts` |
| **`auth.uid()`** | Postgres 函式，回傳目前登入使用者 UUID；未登入為 `null`。用於 RLS policy。 | `infra/supabase/migrations/0001_pm_core.sql` |
| **Workspace（工作區）** | 雲端**租戶邊界**：成員、角色、cloud project、runs、reports、audit 的命名容器。表：`public.workspaces`。 | `0001_pm_core.sql`；[supabase-cloud-auth.md §5](./supabase-cloud-auth.md) |
| **Workspace membership（工作區成員資格）** | 將 Supabase 使用者與 workspace 連結的列，含 **workspace role**。表：`public.workspace_memberships`。 | `0001_pm_core.sql`；`lib/auth/workspaceMemberships.ts` |
| **Workspace role（工作區角色）** | Membership 上的權限標籤：`owner`、`admin`、`developer`、`reviewer`、`viewer`、`user`。與本機 **EngineerRole** 不同。 | `lib/auth/permissions.ts`；DB check `workspace_memberships.role` |
| **Capability（能力旗標）** | 細粒度權限（如 `view:developer-console`、`members:manage`），由 workspace role 推導，供路由守衛使用。 | `lib/auth/permissions.ts` |
| **RLS**（Row Level Security，列級安全） | Postgres policy 層，限制 anon/authenticated client 可讀寫的列，通常以 `workspace_id` 與 `auth.uid()` 界定。 | [supabase-db-design-standard.md §9](./supabase-db-design-standard.md) |
| **Anon key** | 公開 Supabase API key，**僅在 RLS 正確時**可進瀏覽器。 | [supabase-cloud-auth.md §2](./supabase-cloud-auth.md) |
| **Service-role key** | 可 bypass RLS 的特權 key。不得進入 renderer、靜態匯出或 fixture。 | [supabase-db-design-standard.md §4](./supabase-db-design-standard.md) |

### 3.1 工作區角色（摘要）

| 角色 | 預設路由 | 典型對象 |
| --- | --- | --- |
| `owner`, `admin` | `/admin` | 工作區管理者 |
| `developer` | `/developer` | 需本機 runner 的工程師 |
| `reviewer` | `/portal` | 僅 review 的利害關係人 |
| `viewer`, `user` | `/portal` | 一般使用者（Portal 唯讀） |

完整 capability 矩陣：`lib/auth/permissions.ts`（`ROLE_CAPABILITIES`）。

## 4. Project — 兩種意思

| 術語 | 定義 | SSOT / 指標 |
| --- | --- | --- |
| **Local project（本機專案）** | 磁碟上含 `.project-manager/config.json`（專案 manifest）的資料夾。擁有 features、progress sheets、adapters 與本機工程狀態。 | [storage-and-schema.md §1–§2](./storage-and-schema.md)；`lib/types/index.ts` |
| **Cloud project（雲端專案）** | Postgres 中隸屬 workspace 的 metadata 列：名稱、solution URL、Portal 連結。表：`public.projects`。 | `0001_pm_core.sql`；`lib/auth/portalProjects.ts` |
| **Project manifest（專案 manifest）** | 檔案 `.project-manager/config.json` — 本機專案身分與設定的長期 SSOT。 | [storage-and-schema.md §1](./storage-and-schema.md) |

**勿混淆** local project 與 cloud project。可能指同一真實專案，但在 sync/writeback 合約完成前由不同 owner 儲存。

## 5. Feature、Artifact 與 Progress

| 術語 | 定義 | SSOT / 指標 |
| --- | --- | --- |
| **Feature（本機）** | 本機 manifest 中的工作項（`Feature`），含 spec/TDD/dev log 路徑與 dashboard 進度。ID 如 `F47`。 | `lib/types/index.ts`；`.project-manager/features/<ID>/` |
| **Feature（雲端）** | Postgres 協作 metadata（`public.features`）：狀態、進度百分比、指標 — 非完整 spec 正文。 | `lib/supabase/cloudSchema.ts`；migration `0002` |
| **Feature artifact（功能 artifact）** | `.project-manager/features/<ID>/` 下的人類撰寫文件（`README.md`、`feature-spec.md` 等）。 | [file-naming-standards.md §4](../file-naming-standards.md) |
| **Progress sheet（進度表）** | 各 discipline 的進度表設定：`.project-manager/progress-sheets/<sheetId>/config.json`。 | [storage-and-schema.md §2](./storage-and-schema.md) |
| **Schema version（schema 版本）** | 本機 config 整數（`schemaVersion`），breaking manifest 變更時遞增。 | [storage-and-schema.md §4](./storage-and-schema.md)；`lib/storage/migrate.ts` |

## 6. 角色 — 勿混淆

| 術語 | 定義 | SSOT / 指標 |
| --- | --- | --- |
| **Workspace role** | 雲端 `workspace_memberships.role` 權限。控制 `/login`、`/portal`、`/developer`、`/admin`。 | 上文 §3 |
| **EngineerRole（工程師角色）** | 桌面 app 本機 AI/工程 persona：skills、system prompt、模型預設。用於 dispatch，非雲端路由 RBAC。 | `lib/types/index.ts`；`app/engineers/` |
| **Harness task role** | 本機 feature harness 的 planner/worker/evaluator — 編排切片，非 workspace RBAC。 | `lib/types/index.ts` |

## 7. Surface 與 Runner

| 術語 | 定義 | SSOT / 指標 |
| --- | --- | --- |
| **User Portal（使用者入口）** | 路由 `/portal`：進度、報告、方案連結，無需本機執行。Capability：`view:portal`。 | `app/portal/` |
| **Developer Console（開發者主控台）** | 路由 `/developer`：runners、agent runs、sync cursors。Capability：`view:developer-console`。 | `app/developer/` |
| **Admin Console（管理主控台）** | 路由 `/admin`：成員、角色、audit。Capability：`view:admin-console`。 | `app/admin/` |
| **Developer Runner（開發者 Runner）** | Rust/Tauri 本機執行層：repo、程序、Keychain、runner 配對。非雲端 CRUD backend。 | [ADR-016](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md) |
| **Runner device** | 已配對機器的雲端 registry 列（`public.runner_devices`）。 | `lib/auth/runnerDevices.ts` |
| **Runner state** | 客戶端就緒狀態：`missing`、`paired_offline`、`project_blocked`、`ready`、`error`。僅 `ready` 可 dispatch。 | `lib/auth/runnerStatus.ts` |
| **Agent run** | 派工/佇列執行的雲端 metadata（`public.agent_runs`）。原始 log 不在 Postgres。 | `lib/auth/agentRuns.ts` |
| **Bridge（橋接層）** | 型別化 Tauri IPC：元件只呼叫 `lib/bridge/index.ts`，禁止裸 `invoke()`。 | [runtime-bridge.md](./runtime-bridge.md) |

## 8. 雲端 Metadata 表（簡表）

| 術語 | 表 | 內容 |
| --- | --- | --- |
| **Report metadata** | `report_metadata` | Portal 報告索引（非正文） |
| **Sync cursor** | `sync_cursors` | 本機/雲端 revision 指標（供日後 writeback） |
| **Audit log** | `audit_logs` | 成員變更、runner 配對、特權操作 |
| **Workspace invite** | `workspace_invites` | Email 邀請（在 `/login` 接受） |

Row 型別：`lib/supabase/cloudSchema.ts`。RLS 清單：`lib/supabase/rlsContracts.ts`。

## 9. 維護規則

引入在**多份文件或多個模組**共用的新產品名詞時：

1. 在本文件英文區新增定義與 SSOT 指標。
2. 在 §中文版本新增對應條目。
3. 各 runbook 以連結引用，避免 inline 重複定義。
