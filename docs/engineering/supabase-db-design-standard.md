# Supabase Database Design Standard

> Status: Active  
> Last updated: 2026-06-21  
> Audience: Backend engineers, full-stack engineers, DB reviewers, AI agents  
> Classification: internal  
> Related: [ADR-016](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md), [storage-and-schema.md](./storage-and-schema.md), [supabase-cloud-auth.md](./supabase-cloud-auth.md)

---

## English Version

## 1. Purpose

This document is the **single source of truth (SSOT)** for designing, reviewing, and changing Project Manager's Supabase-compatible Postgres schema.

It applies whenever `activeBackendProfileMode` is **not** `local-files`:

| Mode | Applies |
| --- | --- |
| `local-docker-supabase` | Yes |
| `self-hosted-supabase` | Yes |
| `supabase-cloud` | Yes |
| `local-files` | No — follow [storage-and-schema.md](./storage-and-schema.md) only |

Supabase is a **compatible control plane**, not a mandatory cloud vendor. The same rules apply to local Docker Supabase, company self-hosted stacks, and Supabase Cloud.

**Do not treat the Supabase Dashboard as the schema source of truth.** All durable schema changes must land as versioned SQL migrations under `infra/supabase/migrations/`.

## 2. Architecture Context

Project Manager uses a **dual-storage model**:

```text
Supabase Postgres     = collaboration state, auth-linked permissions, audit, run metadata
.project-manager/     = engineering artifacts, feature specs, progress sheet rows (local-first)
Git / project files   = reviewable documents and long-term engineering source of truth
Object storage        = large binaries, raw run logs, report assets
Rust/Tauri runner     = local execution only — not the ordinary CRUD backend
```

Before adding a column or table, decide **which owner** holds the data. See [ADR-016 § Data Ownership](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md#data-ownership).

| Data | Primary owner | Postgres role |
| --- | --- | --- |
| Auth sessions | Supabase Auth | Do not duplicate |
| Users / workspaces / memberships / roles | Postgres | Full row storage + RLS |
| Project metadata, solution URLs | Postgres | Metadata + links |
| Feature specs, TDD specs, dev logs | Git / project files | Store pointers only (`url`, `path`, `sha`) |
| Progress sheet row data | `.project-manager/` first | Sync metadata only until writeback contract is defined |
| Run metadata | Postgres | Status, runner ID, duration, summary |
| Raw run logs | Object storage or runner artifacts | Never unbounded `text` rows |
| Secrets | OS Keychain / ops env | Never in Postgres |

## 3. Pre-Design Concepts (Field Constraints)

Every engineer must understand these **before** opening the table designer:

| Concept | Meaning | Default guidance |
| --- | --- | --- |
| **Primary Key** | Stable row identity | Always `id uuid primary key default gen_random_uuid()` unless a strong reason exists |
| **Identity / generated** | DB-assigned unique value | Prefer `gen_random_uuid()` over client-generated IDs |
| **Non-Nullable** | Value required on every row | Use for identity, FKs, status enums, `created_at` |
| **Nullable** | Value optional | Default in Postgres; use deliberately |
| **Unique** | No duplicate values in column/set | Email, slug, `(workspace_id, user_id)` pairs |
| **Foreign Key** | Relational integrity | Required for all parent-child relationships |
| **Check constraint** | Valid enum/range | Prefer `check (role in (...))` over unchecked `text` |
| **Default** | Insert-time fallback | Use for timestamps and status; document business meaning |

Constraints define **valid data**. They do not define **who may read or write it** — that is RLS (§7).

## 4. Iron Rules

Violations are defects, not style preferences.

1. **RLS on every `public` table.** Never ship a table in `public` without RLS enabled and policies reviewed in the same migration. Do not leave "RLS enabled, zero policies" in production.
2. **No service-role key in renderer code.** Browser and static export use anon key + RLS only. Service role is server-side, migrations, or ops scripts.
3. **No secrets in Postgres.** API keys, JWT secrets, database passwords, and runner tokens do not belong in columns.
4. **Migrations only.** Dashboard edits are for exploration; production schema changes require a numbered file in `infra/supabase/migrations/`.
5. **Workspace scope on collaborative rows.** Any row a user can access must be reachable through `workspace_id` (directly or via join) for RLS.
6. **Timestamps in UTC.** Use `timestamptz`, not `timestamp without time zone`.
7. **Idempotent migrations.** Use `if not exists`, `on conflict do nothing`, or guarded `do $$` blocks where re-run safety matters.
8. **No silent data loss.** Prefer soft delete (`deleted_at`) for user-facing entities. Hard `on delete cascade` only where the product explicitly allows permanent removal.
9. **Bounded Postgres payloads.** Do not store unbounded logs, file bodies, or large JSON blobs in Postgres; use Storage or external artifacts.
10. **TypeScript types follow migrations.** After schema change, update generated or hand-maintained types in `lib/` and add/adjust tests.

## 5. Naming Conventions

| Object | Rule | Example |
| --- | --- | --- |
| Tables | plural, `snake_case`, English | `workspaces`, `agent_runs`, `audit_logs` |
| Columns | `snake_case` | `workspace_id`, `created_at`, `solution_detail_url` |
| Primary key | always `id` | `id uuid primary key` |
| Foreign keys | `<entity>_id` | `workspace_id`, `project_id`, `user_id` |
| Indexes | `idx_<table>_<columns>` | `idx_projects_workspace_id` |
| Policies | `pm_<table>_<action>_<scope>` | `pm_projects_read_member` |
| Schemas | `public` for product data; `pm_system` for ops metadata | see §8 |
| Enums | prefer `check (...)` in v1; promote to `create type` when stable | `role in ('owner', 'admin', ...)` |

**Consistency:** match existing baseline tables in `0001_pm_core.sql`. Do not mix camelCase column names in Postgres.

## 6. Standard Column Patterns

### 6.1 Required on every product table

```sql
id uuid primary key default gen_random_uuid(),
created_at timestamptz not null default now()
```

### 6.2 Strongly recommended

```sql
updated_at timestamptz not null default now(),
-- trigger or application layer must refresh updated_at on update
deleted_at timestamptz null  -- soft delete; null = active
```

### 6.3 Workspace-scoped tables

```sql
workspace_id uuid not null references public.workspaces(id) on delete cascade
```

Add an index on `workspace_id` on every scoped table.

### 6.4 User-attributed rows

When a row is owned by or created by a person:

```sql
user_id uuid not null references auth.users(id) on delete restrict
-- or created_by uuid references auth.users(id)
```

Use `auth.users(id)` when Supabase Auth is wired; document fallback for bare Postgres dev.

### 6.5 Data types

| Use case | Type | Avoid |
| --- | --- | --- |
| IDs | `uuid` | serial integers for public IDs |
| Counts / money | `bigint`, `numeric(p,s)` | `float` for money |
| Short labels | `text` with `check` or lookup table | uncontrolled free text for enums |
| Flags | `boolean not null default false` | `text 'yes'/'no'` |
| JSON metadata | `jsonb` with documented shape | `jsonb` as unbounded document store |
| Timestamps | `timestamptz` | `timestamp`, Unix int in new tables |
| URLs / paths | `text` with length check if needed | varchar(255) unless required |

### 6.6 Workspace-scoped external identifiers

Human-readable or client-generated strings (`runner_id`, `feature_key`, slug) are **not globally unique**. Different workspaces may use the same string safely. Scope them with `workspace_id`:

| Rule | Implementation | Example |
| --- | --- | --- |
| Registry uniqueness | Composite unique on `(workspace_id, key)` | `runner_devices unique (workspace_id, runner_id)` |
| Child references | Prefer FK to registry PK (`uuid`) | `agent_runs.runner_device_id → runner_devices.id` |
| Queries | Always filter by `workspace_id` + key | `where workspace_id = $1 and runner_id = $2` |
| Cross-table integrity | Trigger or composite FK when PK is uuid but tenant matters | `pm_enforce_agent_run_runner_workspace()` |
| Transition | Text key may remain as denormalized snapshot | Keep `agent_runs.runner_id` for logs; write `runner_device_id` as canonical |

Do **not**:

- add `unique (runner_id)` without `workspace_id`;
- join or authorize using bare `runner_id` alone;
- treat a text key as a global primary identifier.

## 7. Relationships

Model relationships explicitly before creating tables:

| Pattern | Implementation | Example |
| --- | --- | --- |
| One-to-one | FK with `unique` on child side | `profiles.user_id unique` |
| One-to-many | FK on child | `projects.workspace_id` |
| Many-to-many | Junction table with composite unique | `workspace_memberships (workspace_id, user_id)` |

**FK delete behavior:**

| Behavior | When |
| --- | --- |
| `on delete cascade` | Child has no meaning without parent (membership, scoped child row) |
| `on delete set null` | Optional reference (e.g. `agent_runs.project_id`) |
| `on delete restrict` | Prevent accidental orphaning of audit-critical parents |

Always index FK columns used in joins and RLS subqueries.

## 8. Schema Layout

| Schema | Purpose |
| --- | --- |
| `public` | Product tables exposed to Supabase client (`workspaces`, `projects`, …) |
| `pm_system` | Internal migration bookkeeping, feature flags, ops tables not for client SELECT |
| `auth` | Managed by Supabase Auth — do not hand-edit |
| `storage` | Managed by Supabase Storage — policies via Storage RLS |

New product tables go in `public` unless there is an ADR to isolate them.

Record applied migrations in `pm_system.schema_migrations` (see `0001_pm_core.sql`).

## 9. Row Level Security (RLS)

RLS is the **authorization layer**. Application checks are not sufficient when the anon key can reach Postgres.

### 9.1 Policy design principles

1. Enable RLS in the **same migration** that creates the table.
2. Default stance: **deny all**, then add explicit `select` / `insert` / `update` / `delete` policies.
3. Scope reads by membership:

```sql
exists (
  select 1 from public.workspace_memberships m
  where m.workspace_id = <table>.workspace_id
    and m.user_id = (select auth.uid())
)
```

4. Use `(select auth.uid())` rather than bare `auth.uid()` in policies (initplan optimization).
5. Split policies by action and role when behavior differs — do not one giant policy.
6. **Service role bypasses RLS** — use only server-side; never in the desktop renderer or static export.

### 9.2 Role matrix (baseline)

Roles are stored on `workspace_memberships.role`:

| Role | Typical read | Typical write |
| --- | --- | --- |
| `owner`, `admin` | Workspace-wide | Membership, settings, integrations, audit |
| `developer` | Projects, runs, execution surfaces | Run dispatch, runner-linked actions |
| `reviewer` | Projects, reports, progress metadata | Review actions only |
| `viewer`, `user` | Portal-safe project progress and reports | Read-only |

Exact policy SQL must be reviewed per table. See [supabase-cloud-auth.md](./supabase-cloud-auth.md).

### 9.3 RLS testing (required before production)

Each migration that adds or changes policies must include or update tests that verify:

- Member can read own workspace rows
- Non-member cannot read (`403` / empty result under RLS)
- Role downgrade removes access
- Direct row ID guess does not bypass workspace scope

Use seeded fixtures or marked integration tests — not production data.

## 10. Indexes

Create indexes for:

- Every FK column used in joins (`workspace_id`, `project_id`, `user_id`)
- Columns used in `where`, `order by`, and RLS subqueries
- Composite unique constraints (automatically indexed)

Avoid indexing:

- Low-cardinality flags alone (`status` unless heavily filtered)
- Write-heavy tables with many unused indexes
- Large `text` / `jsonb` fields without a query plan

Name explicitly: `create index idx_agent_runs_workspace_created on public.agent_runs (workspace_id, created_at desc);`

## 11. Migration Workflow

### 11.1 File naming

```text
infra/supabase/migrations/
  0001_pm_core.sql
  0002_<short_slug>.sql
  0003_<short_slug>.sql
```

Use zero-padded sequence numbers and a short English slug. One logical change per file when possible.

### 11.2 Migration content checklist

Each migration file must:

1. State intent in a header comment (feature ID, ADR link if strategic).
2. Create/alter objects with idempotent guards where feasible.
3. Enable RLS and add policies for any new `public` table.
4. Grant required privileges (`grant usage on schema public to anon, authenticated, service_role` already in baseline).
5. Insert its version into `pm_system.schema_migrations`.
6. Avoid destructive changes without backfill + ADR (`drop column`, `truncate`).

### 11.3 Environments

| Environment | How migrations apply |
| --- | --- |
| Local Docker (`docker/supabase`, `infra/supabase`) | Init scripts / compose mount / installer |
| Self-hosted / Cloud | CI or ops pipeline runs SQL in order |

Never apply migrations manually to production without the same file committed to git.

### 11.4 Connection modes

| Client | Connection | Key |
| --- | --- | --- |
| Browser / static export | Supabase JS + PostgREST | Anon + user JWT |
| Server route / edge (if added) | Pooler or direct | Service role or scoped server secret |
| Migrations / ops | Direct Postgres | DB password — ops only |

Document pooler vs direct in deployment runbooks; do not embed credentials in this repo.

## 12. Storage and Realtime

| Concern | Rule |
| --- | --- |
| File uploads | Supabase Storage buckets with bucket-level policies mirroring workspace scope |
| Large artifacts | Storage path + metadata row in Postgres (`storage_path`, `byte_size`, `content_type`) |
| Realtime | Subscribe only to channels scoped by RLS-visible data; no global broadcast of workspace data |
| Backups | Postgres daily backup ≠ Storage objects — plan both |

## 13. Sync with Local Project Files

Until an explicit writeback contract exists (F55+):

1. **Local files win** for feature content and progress sheet rows during conflict.
2. Postgres stores **metadata and links** (`solution_detail_url`, cloud IDs, sync cursors).
3. Any bidirectional sync requires: idempotency keys, `updated_at` comparison, and an ADR.

Do not mirror entire `.project-manager/config.json` blobs into Postgres without a migration plan.

## 14. Audit and Compliance

Tables that record privileged actions (`audit_logs`, membership changes, runner pairing) must include:

```sql
actor_user_id uuid,
action text not null,
resource_type text not null,
resource_id uuid,
metadata jsonb,
created_at timestamptz not null default now()
```

Audit rows are **append-only** — no `update`/`delete` policies for ordinary roles.

## 15. Change Checklist (PR gate)

Before merging a schema PR:

- [ ] Migration file added under `infra/supabase/migrations/`
- [ ] RLS enabled + policies for new/changed `public` tables
- [ ] `pm_system.schema_migrations` row inserted
- [ ] Types/queries updated in `lib/` (and tests)
- [ ] No service-role or DB password in client-reachable code
- [ ] Data ownership matches ADR-016 (not duplicating file-owned content)
- [ ] Index added for new FK / filter columns
- [ ] [storage-and-schema.md](./storage-and-schema.md) or this doc updated if ownership rules change
- [ ] ADR opened for breaking or strategic schema decisions
- [ ] RLS contract tests added or updated (`__tests__/supabase.migrations.rls-contract.test.ts`)
- [ ] Optional live Postgres check: `PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls`
- [ ] `npm run verify:baseline` passes

## 16. Anti-Patterns

| Anti-pattern | Why it hurts |
| --- | --- |
| Dashboard-only schema change | Untracked drift between envs |
| `public` table without RLS | Data exposure via anon key |
| Storing files/logs in Postgres | Cost, backup size, slow queries |
| Client-side-only authorization | Bypassable with direct API calls |
| `text` for all fields | No integrity, poor indexing |
| Missing `workspace_id` | RLS becomes complex and error-prone |
| Global `unique` on workspace-scoped text (`runner_id`, slug) | Cross-tenant collisions; blocks legitimate reuse across workspaces |
| Bare text runner/key reference without workspace check | Can link rows across workspaces; bypasses tenant boundary |
| `user_id` without FK to `auth.users` | Orphan rows, broken joins |
| One mega `jsonb` config column | Unqueryable, untestable, sync conflicts |
| Hard delete for audit-relevant data | Compliance and recovery risk |
| `select *` in policies on large tables | Performance surprises at scale |

## 17. Baseline Schema Reference

Current scaffold (`infra/supabase/migrations/0001_pm_core.sql`):

| Table | Purpose |
| --- | --- |
| `workspaces` | Workspace identity |
| `workspace_memberships` | User ↔ workspace + role |
| `projects` | Cloud project metadata |
| `agent_runs` | Run metadata |

`0002_features_audit_logs.sql` adds `features` and `audit_logs`. `0003_runner_devices.sql` adds Developer Runner pairing metadata (`runner_devices`). `0004_agent_runs_runner_device_fk.sql` links `agent_runs.runner_device_id` to `runner_devices.id` with a same-workspace trigger guard. `0005_report_metadata.sql` adds the User Portal report index (`report_metadata`). `0006_sync_cursors.sql` adds local/cloud sync cursor bookkeeping (`sync_cursors`).

Extend this baseline using the rules above — do not fork ad hoc naming.

## 19. RLS Verification Assets

| Asset | Purpose |
| --- | --- |
| `lib/supabase/rlsContracts.ts` | SSOT list of RLS-protected tables and expected SELECT policies |
| `__tests__/supabase.migrations.rls-contract.test.ts` | Always-on migration/policy contract tests (runs in `npm test`) |
| `infra/supabase/tests/fixtures/rls_seed.sql` | Deterministic membership fixture UUIDs |
| `infra/supabase/tests/rls_membership.test.sql` | Live Postgres allow/deny assertions |
| `scripts/test-supabase-rls.mjs` | Opt-in integration runner |
| `.github/pull_request_template.md` | PR checklist mirroring §15 |

Commands:

```bash
npm test -- --run __tests__/supabase.migrations.rls-contract.test.ts
npm run test:supabase-rls
PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls
```

## 18. Quick Reference Card

```text
Design order:
  1. Data owner (Postgres vs files vs Storage)
  2. Relationships + FKs
  3. Columns + types + constraints
  4. Indexes for query + RLS paths
  5. RLS policies per role/action
  6. Migration file + tests
  7. TypeScript types + verify:baseline
```

---

## 中文版本

## 1. 目的

本文件是 Project Manager **Supabase-compatible Postgres schema** 設計、審查與變更的 **single source of truth（SSOT）**。

只要 `activeBackendProfileMode` **不是** `local-files`，就必須遵循本規範：

| Mode | 適用 |
| --- | --- |
| `local-docker-supabase` | 是 |
| `self-hosted-supabase` | 是 |
| `supabase-cloud` | 是 |
| `local-files` | 否 — 僅遵循 [storage-and-schema.md](./storage-and-schema.md) |

Supabase 是 **compatible control plane**，不是強制雲端供應商。本規範同等適用於本機 Docker Supabase、公司自架 stack、Supabase Cloud。

**不要把 Supabase Dashboard 當 schema SSOT。** 所有持久 schema 變更必須以版本化 SQL migration 提交至 `infra/supabase/migrations/`。

## 2. 架構背景

Project Manager 採 **雙儲存模型**：

```text
Supabase Postgres     = 協作狀態、auth 權限、audit、run metadata
.project-manager/     = 工程 artifact、feature spec、progress sheet rows（local-first）
Git / project files   = 可 review 文件與長期 engineering SSOT
Object storage        = 大型 binary、raw run logs、report assets
Rust/Tauri runner     = 僅本地執行 — 不是一般 CRUD backend
```

新增 table/column 前，先決定 **資料 owner**。見 [ADR-016 § Data Ownership](../architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md#data-ownership)。

| 資料 | 主要 owner | Postgres 角色 |
| --- | --- | --- |
| Auth sessions | Supabase Auth | 不要重複建表 |
| Users / workspaces / memberships / roles | Postgres | 完整 row + RLS |
| Project metadata、solution URLs | Postgres | Metadata + links |
| Feature spec、TDD、dev log | Git / project files | 只存 pointer（`url`、`path`、`sha`） |
| Progress sheet row data | `.project-manager/` 優先 | 在 writeback 合約定義前僅 sync metadata |
| Run metadata | Postgres | 狀態、runner ID、duration、summary |
| Raw run logs | Object storage 或 runner artifacts | 不要用無上限 `text` row |
| Secrets | OS Keychain / ops env | 不可進 Postgres |

## 3. 設計前必懂觀念（欄位約束）

開 table designer 前，每位工程師必須理解：

| 概念 | 意義 | 預設建議 |
| --- | --- | --- |
| **Primary Key** | 穩定 row identity | 一律 `id uuid primary key default gen_random_uuid()`，除非有充分理由 |
| **Identity / 自動產生** | DB 指派唯一值 | 優先 `gen_random_uuid()`，少由 client 生成 ID |
| **Non-Nullable** | 每列必填 | 用於 identity、FK、status enum、`created_at` |
| **Nullable** | 可空 | Postgres 預設；需刻意選擇 |
| **Unique** | 欄位/組合不可重複 | email、slug、`(workspace_id, user_id)` |
| **Foreign Key** | 關聯完整性 | 所有 parent-child 關係必須有 FK |
| **Check constraint** | 合法 enum/範圍 | 用 `check (role in (...))`，避免 unchecked `text` |
| **Default** | INSERT 預設值 | timestamps、status 要有 default；文件化商業意義 |

約束定義 **資料是否合法**，不定義 **誰能讀寫** — 那是 RLS（§7）。

## 4. Iron Rules

違反即 defect，不是風格問題。

1. **每個 `public` table 必須 RLS。** 不可上線「已 enable RLS 但零 policies」的表。
2. **Renderer 不可用 service-role key。** Browser/static export 僅 anon key + RLS。Service role 限 server-side、migration、ops script。
3. **Secrets 不進 Postgres。** API key、JWT secret、DB 密碼、runner token 不可入欄。
4. **只用 migration 改 schema。** Dashboard 僅供探索；production 變更必須有 `infra/supabase/migrations/` 編號檔。
5. **協作 row 必須 workspace scope。** 使用者可存取的 row 必須能透過 `workspace_id`（直接或 join）寫 RLS。
6. **時間用 UTC。** 使用 `timestamptz`，不用 `timestamp without time zone`。
7. **Migration 要 idempotent。** 適當使用 `if not exists`、`on conflict do nothing`、 guarded `do $$`。
8. **禁止 silent data loss。** 面向使用者實體優先 soft delete（`deleted_at`）。Hard `on delete cascade` 僅在產品明確允許永久刪除時使用。
9. **Postgres payload 有上限。** 不可把 unbounded logs、檔案內容、超大 JSON 塞進 Postgres；用 Storage 或外部 artifact。
10. **TypeScript types 跟 migration 走。** Schema 變更後更新 `lib/` types 並調整 tests。

## 5. 命名規範

| 物件 | 規則 | 範例 |
| --- | --- | --- |
| Tables | 複數、`snake_case`、英文 | `workspaces`, `agent_runs`, `audit_logs` |
| Columns | `snake_case` | `workspace_id`, `created_at` |
| Primary key | 固定 `id` | `id uuid primary key` |
| Foreign keys | `<entity>_id` | `workspace_id`, `project_id`, `user_id` |
| Indexes | `idx_<table>_<columns>` | `idx_projects_workspace_id` |
| Policies | `pm_<table>_<action>_<scope>` | `pm_projects_read_member` |
| Schemas | `public` 產品資料；`pm_system` ops metadata | 見 §8 |
| Enums | v1 用 `check (...)`；穩定後再 `create type` | `role in ('owner', 'admin', ...)` |

**一致性：** 對齊 `0001_pm_core.sql` baseline。Postgres 欄位不要用 camelCase。

## 6. 標準欄位模式

### 6.1 每張 product table 必填

```sql
id uuid primary key default gen_random_uuid(),
created_at timestamptz not null default now()
```

### 6.2 強烈建議

```sql
updated_at timestamptz not null default now(),
deleted_at timestamptz null  -- soft delete；null = 有效
```

### 6.3 Workspace-scoped tables

```sql
workspace_id uuid not null references public.workspaces(id) on delete cascade
```

每張 scoped table 都為 `workspace_id` 建 index。

### 6.4 使用者歸屬 row

```sql
user_id uuid not null references auth.users(id) on delete restrict
```

Supabase Auth 已接線時用 `auth.users(id)`；bare Postgres dev 需文件化 fallback。

### 6.5 資料型別

| 用途 | 型別 | 避免 |
| --- | --- | --- |
| ID | `uuid` | 對外 serial integer |
| 計數/金額 | `bigint`, `numeric(p,s)` | 金額用 `float` |
| 短標籤 | `text` + `check` 或 lookup table | enum 用無限制 free text |
| 旗標 | `boolean not null default false` | `text 'yes'/'no'` |
| JSON metadata | 有文件化的 `jsonb` | 把 `jsonb` 當無限 document store |
| 時間 | `timestamptz` | `timestamp`、新表用 Unix int |
| URL/path | `text`（必要時加 length check） | 非必要不要用 varchar(255) |

### 6.6 Workspace-scoped 外部識別碼

人類可讀或由 client 產生的字串（`runner_id`、`feature_key`、slug）**不是全局唯一**。不同 workspace 可以合法使用相同字串；必須用 `workspace_id` 界定範圍：

| 規則 | 實作 | 範例 |
| --- | --- | --- |
| Registry 唯一性 | `(workspace_id, key)` composite unique | `runner_devices unique (workspace_id, runner_id)` |
| 子表引用 | 優先 FK 到 registry PK（`uuid`） | `agent_runs.runner_device_id → runner_devices.id` |
| 查詢 | 永遠用 `workspace_id` + key 一起 filter | `where workspace_id = $1 and runner_id = $2` |
| 跨表完整性 | PK 是 uuid 但 tenant 仍重要時，用 trigger 或 composite FK | `pm_enforce_agent_run_runner_workspace()` |
| 過渡期 | text key 可保留為 denormalized snapshot | 保留 `agent_runs.runner_id` 寫 log；`runner_device_id` 為 canonical |

**不要：**

- 在沒有 `workspace_id` 時做 `unique (runner_id)`；
- 只用裸 `runner_id` 做 join 或授權；
- 把 text key 當全局 primary identifier。

## 7. 關聯建模

建表前先畫清關係：

| 模式 | 實作 | 範例 |
| --- | --- | --- |
| One-to-one | 子表 FK + `unique` | `profiles.user_id unique` |
| One-to-many | 子表 FK | `projects.workspace_id` |
| Many-to-many | 中介表 + composite unique | `workspace_memberships (workspace_id, user_id)` |

**FK delete 行為：**

| 行為 | 時機 |
| --- | --- |
| `on delete cascade` | 沒有 parent 子 row 無意義（membership、scoped child） |
| `on delete set null` | 可選引用（如 `agent_runs.project_id`） |
| `on delete restrict` | 防止 audit 關鍵 parent 被誤刪 |

凡用於 join 與 RLS subquery 的 FK 欄位都要 index。

## 8. Schema 配置

| Schema | 用途 |
| --- | --- |
| `public` | Supabase client 可存取的產品表 |
| `pm_system` | Migration 紀錄、feature flags、不給 client SELECT 的 ops 表 |
| `auth` | Supabase Auth 管理 — 勿手改 |
| `storage` | Supabase Storage — 用 Storage RLS |

新 product table 預設放 `public`，除非 ADR 要求隔離。

Applied migrations 記錄於 `pm_system.schema_migrations`（見 `0001_pm_core.sql`）。

## 9. Row Level Security（RLS）

RLS 是 **授權層**。應用程式檢查不足以防 anon key 直連 Postgres。

### 9.1 Policy 設計原則

1. **建表同一支 migration** 就要 enable RLS。
2. 預設 **全部拒絕**，再逐一加 `select` / `insert` / `update` / `delete` policy。
3. 讀取 scope 用 membership（見英文 §9.1 SQL 範本）。
4. Policy 內用 `(select auth.uid())` 而非 bare `auth.uid()`。
5. 不同 role/action 拆 policy — 不要一條巨大 policy。
6. **Service role  bypass RLS** — 僅 server-side；desktop renderer / static export 不可用。

### 9.2 角色矩陣（baseline）

角色存於 `workspace_memberships.role`：

| 角色 | 典型讀 | 典型寫 |
| --- | --- | --- |
| `owner`, `admin` | Workspace 全域 | Membership、設定、整合、audit |
| `developer` | Projects、runs、執行面 | Run dispatch、runner 相關動作 |
| `reviewer` | Projects、reports、progress metadata | 僅 review 動作 |
| `viewer`, `user` | Portal 可見 progress 與 reports | 唯讀 |

每張表 policy SQL 需個別審查。見 [supabase-cloud-auth.md](./supabase-cloud-auth.md)。

### 9.3 RLS 測試（上線前必做）

Migration 新增或修改 policy 時，測試必須涵蓋：

- Member 可讀自己 workspace rows
- Non-member 不可讀
- Role 降級後失去存取
- 直接猜 row ID 無法 bypass workspace scope

用 seed fixture 或標記 integration test — 不用 production 資料。

## 10. 索引

應建 index：

- 所有 join 用 FK（`workspace_id`, `project_id`, `user_id`）
- `where`、`order by`、RLS subquery 用到的欄位
- Composite unique（Postgres 通常自動建）

避免：

- 單獨低基數 flag（除非大量 filter `status`）
- 寫多讀少表上堆太多 index
- 無 query plan 的大 `text` / `jsonb`

命名範例：`create index idx_agent_runs_workspace_created on public.agent_runs (workspace_id, created_at desc);`

## 11. Migration 流程

### 11.1 檔名

```text
infra/supabase/migrations/
  0001_pm_core.sql
  0002_<short_slug>.sql
```

零填充序號 + 英文短 slug。盡量一個 logical change 一檔。

### 11.2 Migration 內容 checklist

1. Header comment 說明 intent（feature ID、戰略變更加 ADR link）。
2. 盡量 idempotent 建/改物件。
3. 新 `public` table 必須 enable RLS + policies。
4. 維持 baseline grants。
5. 插入 `pm_system.schema_migrations` 版本列。
6. 避免無 backfill + ADR 的 destructive change。

### 11.3 環境

| 環境 | Migration 套用方式 |
| --- | --- |
| Local Docker | Init scripts / compose mount / installer |
| Self-hosted / Cloud | CI 或 ops pipeline 依序執行 SQL |

Production 不可只手動改 DB 而不 commit 同一份 migration 檔。

### 11.4 連線模式

| Client | 連線 | Key |
| --- | --- | --- |
| Browser / static export | Supabase JS + PostgREST | Anon + user JWT |
| Server route（若有） | Pooler 或 direct | Service role 或 scoped server secret |
| Migration / ops | Direct Postgres | DB password — ops only |

Pooler vs direct 寫在 deployment runbook；credentials 不可進 repo。

## 12. Storage 與 Realtime

| 議題 | 規則 |
| --- | --- |
| 檔案上傳 | Storage bucket + 對齊 workspace scope 的 bucket policy |
| 大型 artifact | Storage path + Postgres metadata row |
| Realtime | 只訂閱 RLS 可見資料；禁止 workspace 資料全域 broadcast |
| Backup | Postgres 每日備份 ≠ Storage objects — 兩者都要規劃 |

## 13. 與本地專案檔同步

在明確 writeback 合約前（F55+）：

1. **衝突時 local files 優先**（feature 內容、progress sheet rows）。
2. Postgres 存 **metadata 與 links**。
3. 雙向 sync 需要：idempotency key、`updated_at` 比對、ADR。

不要把整份 `.project-manager/config.json` blob 鏡像進 Postgres 而無 migration 計畫。

## 14. Audit 與合規

特權動作表（`audit_logs`、membership 變更、runner pairing）應含：

```sql
actor_user_id uuid,
action text not null,
resource_type text not null,
resource_id uuid,
metadata jsonb,
created_at timestamptz not null default now()
```

Audit row **僅追加** — 一般 role 不可 `update`/`delete`。

## 15. 變更 Checklist（PR gate）

Schema PR merge 前：

- [ ] `infra/supabase/migrations/` 新增 migration
- [ ] 新/改 `public` table 已 enable RLS + policies
- [ ] 已插入 `pm_system.schema_migrations`
- [ ] 已更新 `lib/` types/tests
- [ ] Client-reachable code 無 service-role / DB password
- [ ] 資料 owner 符合 ADR-016
- [ ] 新 FK/filter 欄位已加 index
- [ ] 若 ownership 規則變更，更新本文件或 storage-and-schema.md
- [ ] 戰略/breaking 變更開 ADR
- [ ] RLS contract tests 新增或更新（`__tests__/supabase.migrations.rls-contract.test.ts`）
- [ ] 可選 live Postgres 檢查：`PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls`
- [ ] `npm run verify:baseline` 通過

## 16. Anti-Patterns

| Anti-pattern | 傷害 |
| --- | --- |
| 只在 Dashboard 改 schema | 環境 drift |
| `public` table 無 RLS | anon key 洩漏資料 |
| 檔案/log 存 Postgres | 成本、備份、查詢變慢 |
| 僅 client 端授權 | 可被 direct API bypass |
| 全部用 `text` | 無完整性、索引差 |
| 缺少 `workspace_id` | RLS 複雜易錯 |
| 對 workspace-scoped text（`runner_id`、slug）做全局 `unique` | 跨 tenant 碰撞；阻止 workspace 間合法重用 |
| 裸 text runner/key 引用且無 workspace 檢查 | 可能跨 workspace 連線；破壞 tenant 邊界 |
| `user_id` 無 FK | orphan row |
| 巨型 `jsonb` config | 難查、難測、sync 衝突 |
| Audit 資料 hard delete | 合規與恢復風險 |
| Policy 對大表 `select *` | 規模化後效能問題 |

## 17. Baseline Schema 參考

現有 scaffold（`infra/supabase/migrations/0001_pm_core.sql`）：

| Table | 用途 |
| --- | --- |
| `workspaces` | Workspace identity |
| `workspace_memberships` | User ↔ workspace + role |
| `projects` | Cloud project metadata |
| `agent_runs` | Run metadata |

`0002_features_audit_logs.sql` 新增 `features` 與 `audit_logs`。`0003_runner_devices.sql` 新增 Developer Runner pairing metadata（`runner_devices`）。`0004_agent_runs_runner_device_fk.sql` 以 `agent_runs.runner_device_id → runner_devices.id` 連結，並用 same-workspace trigger guard。`0005_report_metadata.sql` 新增 User Portal 報告索引（`report_metadata`）。`0006_sync_cursors.sql` 新增 local/cloud sync cursor bookkeeping（`sync_cursors`）。

擴充 baseline 時遵循本規範 — 不要 fork ad hoc 命名。

## 19. RLS 驗證資產

| 資產 | 用途 |
| --- | --- |
| `lib/supabase/rlsContracts.ts` | RLS 保護表與預期 SELECT policies 的 SSOT |
| `__tests__/supabase.migrations.rls-contract.test.ts` | 永遠執行的 migration/policy contract tests（`npm test`） |
| `infra/supabase/tests/fixtures/rls_seed.sql` | 固定 membership fixture UUIDs |
| `infra/supabase/tests/rls_membership.test.sql` | Live Postgres allow/deny 斷言 |
| `scripts/test-supabase-rls.mjs` | Opt-in integration runner |
| `.github/pull_request_template.md` | 對應 §15 的 PR checklist |

指令：

```bash
npm test -- --run __tests__/supabase.migrations.rls-contract.test.ts
npm run test:supabase-rls
PM_SUPABASE_RLS_INTEGRATION=1 npm run test:supabase-rls
```

## 18. 快速參考

```text
設計順序：
  1. 資料 owner（Postgres vs files vs Storage）
  2. 關聯 + FK
  3. 欄位 + 型別 + 約束
  4. Query/RLS 路徑的 index
  5. 依 role/action 的 RLS policies
  6. Migration 檔 + tests
  7. TypeScript types + verify:baseline
```
