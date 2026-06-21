# Supabase Cloud Auth Runbook

> Status: Active  
> Owner: Project Manager engineering  
> Last updated: 2026-06-21  
> Classification: internal  
> Related: [ADR-016](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md), [supabase-db-design-standard.md](./supabase-db-design-standard.md), [storage-and-schema.md](./storage-and-schema.md)

---

## English Version

## 1. Purpose

This runbook describes the Supabase integration boundary for Project Manager cloud workspace flows (F47 / F48). It supports ADR-016.

Supabase owns cloud identity and collaborative product state. Rust/Tauri remains the Developer Runner for local repo access, process execution, OS Keychain, and local cache.

Schema and RLS SSOT live in [supabase-db-design-standard.md](./supabase-db-design-standard.md). This document covers **browser auth**, **workspace session**, **route guards**, and **typed read query contracts** under `lib/auth/`.

## 2. Public Browser Configuration

Client-rendered code may use only public Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Rules:

- The anon key is acceptable in browser code only when Row Level Security policies are correct.
- Never expose service-role keys in browser code, static exports, feature artifacts, logs, screenshots, or test fixtures.
- Use mocked Supabase clients in unit tests unless a live integration test is explicitly marked and isolated.

## 3. Sign-In Methods

`/login` (`app/login/LoginEntry.tsx`) supports two entry paths when Supabase is configured:

| Method | Client helper | Use |
| --- | --- | --- |
| GitHub OAuth | `supabase.auth.signInWithOAuth({ provider: 'github' })` | Shared dev / production when GitHub provider is enabled. |
| Email + password | `signInWithEmailPassword()` in `lib/auth/supabaseAuthSession.ts` | Local Docker Supabase or any project with Email auth enabled when GitHub OAuth is unavailable. |

After sign-in, `useWorkspaceSession()` loads memberships and resolves role-based routing. Sign-out uses `signOutSupabaseAuth()`.

## 4. Auth Session Contract

Module: `lib/auth/supabaseAuthSession.ts`

| Function | Purpose |
| --- | --- |
| `readSupabaseAuthUser()` | Calls `auth.getUser()`; normalizes `{ id, email }`. |
| `signInWithEmailPassword(email, password)` | Calls `auth.signInWithPassword`; returns visible errors (empty fields, invalid credentials). |
| `signOutSupabaseAuth()` | Calls `auth.signOut()`. |
| `subscribeSupabaseAuthChanges(onChange)` | Wraps `onAuthStateChange`; caller must unsubscribe on unmount. |

`useWorkspaceSession()` reads auth first, then memberships. It exposes `signedIn`, `userEmail`, `signOut`, and distinct guard states (`sign_in_required` vs `membership_required`) via `lib/auth/permissions.ts`.

## 5. Workspace Session and Picker

Module: `lib/auth/workspaceSession.ts`

Flow:

1. `readSupabaseAuthUser()` — if not signed in, session stops with `signedIn: false`.
2. `listWorkspaceMemberships()` — rows visible under RLS (`pm_memberships_read_own`).
3. `resolveActiveWorkspaceMembership()` — picks stored workspace or first membership.
4. Client queries pass optional `workspaceId` and `.eq('workspace_id', …)` for picker scoping (RLS still allows cross-workspace reads for multi-member users; UI filters to the active workspace).

Active workspace persistence: `lib/auth/activeWorkspaceStorage.ts` (`pm.activeWorkspaceId` in `localStorage`). Read in `useEffect` after mount — never `useState(() => localStorage…)`.

UI: `app/auth/WorkspacePicker.tsx` when `memberships.length > 1`.

## 6. Minimum Cloud Tables

| Table | Purpose |
| --- | --- |
| `workspaces` | Workspace identity and display name. |
| `workspace_memberships` | User-to-workspace membership with role. |
| `projects` | Cloud project metadata and solution detail URLs. |
| `features` | Cloud feature/task state during migration. |
| `agent_runs` | Run metadata, runner ID, status, summary. |
| `runner_devices` | Developer Runner pairing metadata, heartbeat status, approved project root pointer. |
| `report_metadata` | User Portal report index (not report body). |
| `sync_cursors` | Local/cloud revision pointers for future writeback. |
| `audit_logs` | Role changes, dispatch requests, runner pairing, and privileged actions. |

Migrations: `infra/supabase/migrations/0001`–`0012`. Raw execution logs must not live as unbounded Postgres rows.

## 7. Membership Query Contracts

### 7.1 Own memberships (all signed-in users)

Helper: `listWorkspaceMemberships()` — `lib/auth/workspaceMemberships.ts`

```text
workspace_memberships
  workspace_id
  role
  workspaces(name)
```

RLS: `pm_memberships_read_own` (`user_id = auth.uid()`).

Known roles: `owner`, `admin`, `developer`, `reviewer`, `viewer`, `user`. Malformed rows are dropped client-side.

### 7.2 Workspace roster (Admin Console)

Helper: `listWorkspaceMembers(workspaceId)` — `lib/auth/workspaceMembers.ts`

```text
workspace_memberships
  id
  workspace_id
  user_id
  role
  created_at
```

RLS: `pm_memberships_read_admin` (migration `0007_workspace_memberships_admin_read.sql`) via `pm_is_workspace_admin()` security-definer helper. Gate: `canReadWorkspaceMembers()` in `lib/supabase/rlsContracts.ts` (`owner`, `admin` only).

Role changes use `pm_update_workspace_member_role()` (migration `0008_workspace_membership_role_update.sql`): security-definer RPC granted to `authenticated`, writes `audit_logs`, and enforces owner/admin guardrails without exposing the service-role key. Client helper: `updateWorkspaceMemberRole()`; gate: `canManageWorkspaceMembers()`.

Membership adds use `pm_add_workspace_member()` (migration `0009_workspace_membership_add.sql`): same security-definer pattern for local/dev grants by Supabase auth user UUID (email invite flow lands later). Client helper: `addWorkspaceMember()`; gate: `canManageWorkspaceMembers()`.

Membership removals use `pm_remove_workspace_member()` (migration `0010_workspace_membership_remove.sql`): security-definer RPC with self-removal and last-owner guardrails. Client helper: `removeWorkspaceMember()`; gate: `canEditWorkspaceMemberRole()` (same rules as role edits).

Workspace onboarding uses `pm_create_workspace()` (migration `0011_workspace_create.sql`): any authenticated user can create a workspace and become `owner`. Client helper: `createWorkspace()`; UI: `WorkspaceOnboardingPanel` on `/login` when signed in without membership.

Email invites use `workspace_invites` + `pm_invite_workspace_member()` / `pm_accept_workspace_invite()` (migration `0012_workspace_invites.sql`). Admins create pending invites; invitees accept on `/login` when signed in with the matching email. No outbound mail in this slice — delivery lands later. Client helpers: `inviteWorkspaceMemberByEmail()`, `acceptWorkspaceInvite()`, `listPendingWorkspaceInvites()`.

## 8. Surface Query Contracts

All list helpers:

- Accept optional `workspaceId` and scope with `.eq('workspace_id', workspaceId)`.
- Return `{ items, error }` with visible errors (no silent failures).
- Use typed client mocks in unit tests.

RLS gates are mirrored in `lib/supabase/rlsContracts.ts` (`canRead*` helpers). Panels call the gate before querying.

| Surface | Route | Helper | Table | RLS gate |
| --- | --- | --- | --- | --- |
| User Portal — reports | `/portal` | `listPortalReports()` | `report_metadata` | member + published/draft policy |
| User Portal — projects | `/portal` | `listPortalProjects()` | `projects` | `pm_projects_read_member` |
| User Portal — features | `/portal` | `listPortalFeatures()` | `features` | `pm_features_read_member`, `.is('deleted_at', null)` |
| User Portal — solutions | `/portal` | uses `listPortalProjects()` | `projects.solution_detail_url` | same as projects |
| Developer — runners | `/developer` | `listRunnerDevices()` | `runner_devices` | `canReadRunnerDevices` |
| Developer — sync cursors | `/developer` | `listSyncCursors()` | `sync_cursors` | `canReadSyncCursors` |
| Developer — agent runs | `/developer` | `listAgentRuns()` | `agent_runs` | member |
| Admin — members | `/admin` | `listWorkspaceMembers()` | `workspace_memberships` | `canReadWorkspaceMembers` |
| Admin — audit | `/admin` | `listAuditLogs()` | `audit_logs` | `canReadAuditLogs` |

### 8.1 Report metadata (Portal)

`listPortalReports()` — `lib/auth/reportMetadata.ts`

```text
report_metadata
  id, workspace_id, project_id, report_key, title, report_type,
  status, summary, content_url, published_at
  projects(name)
```

RLS: `published` for all members; draft/archived for `owner`, `admin`, `developer`, `reviewer`.

### 8.2 Portal projects and features

`listPortalProjects()` — `projects(id, workspace_id, name, solution_detail_url, created_at)`

`listPortalProjectProgress()` — `lib/auth/portalProjectProgress.ts`; joins `listPortalProjects()` + `listPortalFeatures()` client-side into per-project status counts, average progress, and overall status for the User Portal progress panel.

`listPortalFeatures()` — `features(…, projects(name))` with soft-delete filter.

### 8.3 Developer runners and sync cursors

`listRunnerDevices()` — `runner_devices(id, workspace_id, runner_id, device_label, status, last_seen_at, approved_project_root)`

`listSyncCursors()` — `sync_cursors(…, projects(name))` — revision metadata only; payloads stay in Git / desktop runner.

### 8.4 Agent runs (Developer)

`listAgentRuns()` — `agent_runs(…, projects(name))` — read-only dispatch queue / execution log metadata. Actual dispatch stays on the local runner.

### 8.5 Audit logs (Admin)

`listAuditLogs()` — `audit_logs(id, workspace_id, actor_user_id, action, resource_type, resource_id, metadata, created_at)` — admin/owner only.

Display helpers: `formatAuditActionLabel()` and `formatAuditMetadataPreview(metadata, { action, resourceType })` render human-readable membership and runner summaries instead of raw JSON where the action is known (`membership.added`, `membership.removed`, `membership.role_changed`, `runner.paired`).

## 9. Route Guard Boundary

| Route | Required capability |
| --- | --- |
| `/login` | public entry |
| `/developer` | `view:developer-console` |
| `/portal` | `view:portal` |
| `/admin` | `view:admin-console` |

`evaluateWorkspaceAccess()` statuses: `setup_required`, `sign_in_required`, `membership_required`, `allowed`, `denied`.

Role routing: `resolveWorkspaceDestination()` — `owner`/`admin` → `/admin`; `developer` → `/developer`; `reviewer`/`viewer`/`user` → `/portal`.

## 10. Developer Runner Boundary

Developer dispatch requires both workspace permission and runner readiness.

Runner status model: `lib/auth/runnerStatus.ts` — `missing`, `paired_offline`, `project_blocked`, `ready`, `error`. Only `ready` allows dispatch (future slice).

## 11. RLS Policy Requirements

Before connecting production data:

1. Enable RLS on every protected table (see `PM_RLS_PROTECTED_TABLES` in `lib/supabase/rlsContracts.ts`).
2. Users read only workspace-owned rows where they have membership (plus role-specific policies).
3. Admin roster reads use `pm_is_workspace_admin()` to avoid policy recursion on `workspace_memberships`.
4. Client `.eq('workspace_id', …)` scopes UI to the active workspace picker selection.
5. Privileged writes use service-role (bypasses RLS) and must emit `audit_logs` rows.

Optional live verification:

```bash
PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker
```

## 12. Local Development

| Mode | Use |
| --- | --- |
| Mocked clients | Unit tests and route-guard logic. |
| Shared dev Supabase | GitHub OAuth sign-in and route smoke. |
| Local Docker Supabase | Migrations under `infra/supabase/migrations/`; email/password sign-in on `/login`. |

Do not require Docker for general User Portal flows. Docker/local Supabase is a developer convenience, not the default product dependency.

## 13. Verification

Focused auth / cloud read checks:

```bash
npm run test -- --run \
  __tests__/auth.supabaseAuthSession.test.ts \
  __tests__/auth.supabase-role-routing.test.tsx \
  __tests__/login.emailPassword.test.tsx \
  __tests__/auth.workspaceMemberships.test.ts \
  __tests__/auth.workspaceMembers.test.ts \
  __tests__/auth.workspaceSession.test.ts \
  __tests__/supabase.migrations.rls-contract.test.ts
npm run typecheck
npm run verify:dev-issues -- --routes /login,/developer,/portal,/admin
```

Full gate:

```bash
npm run verify:baseline
PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker
```

---

## 中文版本

## 1. 目的

本 runbook 描述 Project Manager 雲端工作區流程（F47 / F48）的 Supabase 整合邊界，對應 ADR-016。

Supabase 負責雲端身分與協作狀態；Rust/Tauri 仍是 Developer Runner，負責本機 repo、程序執行、OS Keychain 與本機快取。

資料表與 RLS 的 SSOT 見 [supabase-db-design-standard.md](./supabase-db-design-standard.md)。本文聚焦 **瀏覽器 auth**、**工作區 session**、**路由守衛**，以及 `lib/auth/` 下的 **型別化唯讀查詢契約**。

## 2. 公開瀏覽器設定

僅允許下列公開環境變數進入 client 程式碼：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

規則：

- anon key 僅在 RLS 正確時可進入瀏覽器。
- service-role key 不得出現在瀏覽器、靜態匯出、fixture、日誌或截圖中。
- 單元測試預設 mock Supabase client； live 整合測試須明確標記並隔離。

## 3. 登入方式

`/login`（`app/login/LoginEntry.tsx`）在 Supabase 已設定時支援兩種入口：

| 方式 | Client 輔助 | 用途 |
| --- | --- | --- |
| GitHub OAuth | `auth.signInWithOAuth({ provider: 'github' })` | 共用 dev / 正式環境（需啟用 GitHub provider）。 |
| Email + 密碼 | `signInWithEmailPassword()`（`lib/auth/supabaseAuthSession.ts`） | 本地 Docker Supabase 或未設定 GitHub OAuth 時的 fallback。 |

登入後由 `useWorkspaceSession()` 載入 membership 並依角色導向；登出使用 `signOutSupabaseAuth()`。

## 4. Auth Session 契約

模組：`lib/auth/supabaseAuthSession.ts`

| 函式 | 用途 |
| --- | --- |
| `readSupabaseAuthUser()` | 呼叫 `auth.getUser()`，正規化 `{ id, email }`。 |
| `signInWithEmailPassword(email, password)` | 呼叫 `auth.signInWithPassword`；空欄位或憑證錯誤須回傳可見錯誤。 |
| `signOutSupabaseAuth()` | 呼叫 `auth.signOut()`。 |
| `subscribeSupabaseAuthChanges(onChange)` | 包裝 `onAuthStateChange`；unmount 時須取消訂閱。 |

`useWorkspaceSession()` 先讀 auth 再讀 membership，並透過 `lib/auth/permissions.ts` 區分 `sign_in_required` 與 `membership_required`。

## 5. 工作區 Session 與 Picker

模組：`lib/auth/workspaceSession.ts`

流程：

1. `readSupabaseAuthUser()` — 未登入則 `signedIn: false`。
2. `listWorkspaceMemberships()` — RLS 下僅能讀取自己的 membership（`pm_memberships_read_own`）。
3. `resolveActiveWorkspaceMembership()` — 依 localStorage 或第一筆 membership 選擇作用中工作區。
4. 各 `list*()` 可傳 `workspaceId` 並 `.eq('workspace_id', …)`；RLS 仍允許多工作區成員跨區讀取，UI 以 picker 過濾。

作用中工作區：`lib/auth/activeWorkspaceStorage.ts`（`pm.activeWorkspaceId`）。須在 `useEffect`  hydration，禁止 `useState(() => localStorage…)`。

UI：`memberships.length > 1` 時顯示 `WorkspacePicker.tsx`。

## 6. 最低雲端資料表

與英文版 §6 相同：`workspaces`、`workspace_memberships`、`projects`、`features`、`agent_runs`、`runner_devices`、`report_metadata`、`sync_cursors`、`audit_logs`。

Migration：`infra/supabase/migrations/0001`–`0012`。大量執行日誌不得無上限寫入 Postgres。

## 7. Membership 查詢契約

### 7.1 自己的 membership（所有已登入使用者）

`listWorkspaceMemberships()` — 查詢形狀同英文 §7.1；RLS：`pm_memberships_read_own`。

### 7.2 工作區成員名單（Admin Console）

`listWorkspaceMembers(workspaceId)` — 查詢形狀同英文 §7.2。

RLS：`0007_workspace_memberships_admin_read.sql` 的 `pm_memberships_read_admin`，透過 `pm_is_workspace_admin()` security definer 函式避免 policy 遞迴。UI 閘門：`canReadWorkspaceMembers()`（僅 `owner`、`admin`）。

目前 Admin 面板透過 `updateWorkspaceMemberRole()` 呼叫 `pm_update_workspace_member_role()` RPC（migration `0008`），以 security definer 寫入 membership 並追加 `audit_logs`，無需在瀏覽器暴露 service-role key。UI 閘門：`canManageWorkspaceMembers()`。

新增成員透過 `addWorkspaceMember()` 呼叫 `pm_add_workspace_member()` RPC（migration `0009`）：同樣以 security definer 寫入 membership 並追加 `membership.added` 稽核紀錄；目前以 Supabase auth user UUID 加入（本地/dev stub），email 邀請流程後續補上。UI 閘門：`canManageWorkspaceMembers()`。

移除成員透過 `removeWorkspaceMember()` 呼叫 `pm_remove_workspace_member()` RPC（migration `0010`）：security definer 刪除 membership 並追加 `membership.removed` 稽核紀錄，含禁止自我移除與最後 owner 保護。UI 閘門：`canEditWorkspaceMemberRole()`（與角色編輯相同規則）。

工作區 onboarding 透過 `createWorkspace()` 呼叫 `pm_create_workspace()` RPC（migration `0011`）：已登入且尚無 membership 的使用者可在 `/login` 建立 workspace 並成為 owner（`WorkspaceOnboardingPanel`）。

Email 邀請使用 `workspace_invites` 表與 `pm_invite_workspace_member()` / `pm_accept_workspace_invite()` RPC（migration `0012`）。Admin 建立 pending invite；受邀者以相同 email 登入後在 `/login` 接受。本 slice 不含 outbound mail。Client helpers：`inviteWorkspaceMemberByEmail()`、`acceptWorkspaceInvite()`、`listPendingWorkspaceInvites()`。

## 8. 各 Surface 查詢契約

所有 `list*()` 輔助函式：

- 可選 `workspaceId` + `.eq('workspace_id', …)`。
- 回傳 `{ items, error }`，錯誤須可見。
- 單元測試使用 typed mock client。

RLS 閘門見 `lib/supabase/rlsContracts.ts` 的 `canRead*`；面板查詢前先檢查。

| Surface | 路由 | Helper | 資料表 | RLS 閘門 |
| --- | --- | --- | --- | --- |
| Portal — 報告 | `/portal` | `listPortalReports()` | `report_metadata` | 成員 + 發布/草稿策略 |
| Portal — 專案 | `/portal` | `listPortalProjects()` | `projects` | 成員 |
| Portal — 功能 | `/portal` | `listPortalFeatures()` | `features` | 成員 + `deleted_at IS NULL` |
| Portal — 方案 | `/portal` | `listPortalProjects()` | `projects.solution_detail_url` | 同專案 |
| Developer — Runner | `/developer` | `listRunnerDevices()` | `runner_devices` | `canReadRunnerDevices` |
| Developer — Sync | `/developer` | `listSyncCursors()` | `sync_cursors` | `canReadSyncCursors` |
| Developer — Agent runs | `/developer` | `listAgentRuns()` | `agent_runs` | 成員 |
| Admin — 成員 | `/admin` | `listWorkspaceMembers()` | `workspace_memberships` | `canReadWorkspaceMembers` |
| Admin — 稽核 | `/admin` | `listAuditLogs()` | `audit_logs` | `canReadAuditLogs` |

各表 SELECT 欄位與 join 形狀見英文 §8.1–§8.5。

## 9. 路由守衛

| 路由 | 所需 capability |
| --- | --- |
| `/login` | 公開入口 |
| `/developer` | `view:developer-console` |
| `/portal` | `view:portal` |
| `/admin` | `view:admin-console` |

`evaluateWorkspaceAccess()` 狀態：`setup_required`、`sign_in_required`、`membership_required`、`allowed`、`denied`。

角色導向：`resolveWorkspaceDestination()` — `owner`/`admin` → `/admin`；`developer` → `/developer`；其餘 portal 角色 → `/portal`。

## 10. Developer Runner 邊界

派工需同時具備工作區權限與 runner 就緒狀態。狀態模型見 `lib/auth/runnerStatus.ts`；僅 `ready` 允許派工（後續實作）。

## 11. RLS 要求

1. 所有受保護表啟用 RLS（`PM_RLS_PROTECTED_TABLES`）。
2. 使用者僅能讀取有 membership 的工作區資料（再加角色專用 policy）。
3. Admin 成員名單使用 `pm_is_workspace_admin()`，避免 `workspace_memberships` policy 遞迴。
4. Client 以 `.eq('workspace_id', …)` 配合 workspace picker。
5. 特權寫入走 service-role 並寫入 `audit_logs`。

Live 驗證：

```bash
PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker
```

## 12. 本地開發

| 模式 | 用途 |
| --- | --- |
| Mock client | 單元測試與路由守衛。 |
| 共用 dev Supabase | GitHub OAuth 與手動 smoke。 |
| 本地 Docker Supabase | `infra/supabase/migrations/` + `/login` email 登入。 |

一般 User Portal 不得硬依賴 Docker。

## 13. 驗證

聚焦測試與 smoke 命令同英文 §13。完成前須通過：

```bash
npm run verify:baseline
PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls -- --docker
```
