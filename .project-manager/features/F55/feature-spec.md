# F55 Feature Spec - Multi-Discipline Progress Sheets and Backend Profiles

## Problem Definition

Project initialization currently creates a project progress model that fits a
software engineering workflow. The dashboard labels and columns assume software
features, development/testing/deployment/operations phases, test coverage,
deploy status, uptime, and response-time metrics.

Project Manager's product boundary is broader than software. It must support
hardware R&D, industrial design, project operations, marketing, content
production, QA validation, construction/field work, procurement, and other
disciplines. Each discipline needs its own progress sheet contract instead of
sharing one software-oriented Development Progress table.

The storage design must also remain enterprise-friendly. Teams must be able to
work local-only, run a local Docker Supabase stack, connect to a company-hosted
Supabase-compatible backend, or use Supabase Cloud without changing the product
model.

## Product Decision

Use a multi-sheet progress model:

```text
.project-manager/
  config.json
  progress-sheets/
    software-desktop-app/
      config.json
    hardware-rd/
      config.json
    industrial-design/
      config.json
```

`config.json` becomes the project manifest and sheet index. It does not own all
discipline-specific progress columns. Each sheet config owns:

- sheet identity and title;
- template snapshot;
- column definitions;
- status/phase options;
- row data or a pointer to row sidecars;
- migration metadata for that sheet contract.

System template updates never mutate an already initialized sheet in place. A
sheet is initialized from a template snapshot and can later be upgraded through
an explicit migration or mapping flow.

## In Scope

- Add a project manifest model for multiple progress sheets.
- Add progress sheet config files under
  `.project-manager/progress-sheets/<sheetId>/config.json`.
- Rename UI concepts from hard-coded `Development Progress` to dynamic sheet
  titles.
- Add built-in templates for:
  - Desktop App Development
  - Backend/API Development
  - Hardware R&D
  - Industrial Design
  - Project Operations
  - Marketing Campaign
  - Content Production
  - QA Validation
  - Construction / Field Work
  - Procurement / Vendor Management
- Add a project initialization template picker that can select one or more
  progress sheets.
- Support user custom templates with fields:
  - `text`
  - `number`
  - `date`
  - `select`
  - `multiSelect`
  - `tag`
  - `person`
  - `percent`
  - `link`
  - `file`
- Support column ordering, visibility, required flags, default values, and
  option sets.
- Support safe template switching:
  - existing row values are preserved;
  - unmapped fields remain archived or hidden;
  - user can map old fields to new fields;
  - no switch may silently delete progress data.
- Add backend connector profile requirements:
  - `local-files`
  - `local-docker-supabase`
  - `self-hosted-supabase`
  - `supabase-cloud`
- Clarify that Supabase is a compatible control plane, not necessarily a cloud
  dependency.
- Include local Docker Supabase completion as an early infrastructure work
  package.

## Out of Scope

- Replacing local `.project-manager/` files as the first implementation source
  of truth.
- Live multi-user sync conflict resolution beyond the planned sync contract.
- Full production hardening of self-hosted Supabase in the first progress-sheet
  UI slice.
- Removing existing software project fields before migration coverage exists.
- Direct service-role key access from the renderer.

## Storage Model

### Project Manifest

`.project-manager/config.json` remains the project-level source of truth for
identity, metadata, adapters, roles, cron jobs, and sheet index.

Planned additive shape:

```ts
interface ProjectManagerConfig {
  schemaVersion: number;
  project: ProjectIdentity;
  progressSheets?: ProjectProgressSheetRef[];
}

interface ProjectProgressSheetRef {
  id: string;
  label: string;
  discipline: ProgressDiscipline;
  configPath: string;
  templateId: string;
  templateVersion: number;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Sheet Config

Each sheet config is independently versioned:

```ts
interface ProgressSheetConfig {
  schemaVersion: number;
  id: string;
  sheetTitle: string;
  discipline: ProgressDiscipline;
  templateSnapshot: ProgressTemplateSnapshot;
  columns: ProgressColumn[];
  statusOptions: ProgressOption[];
  phaseOptions?: ProgressOption[];
  rows: ProgressRow[];
  archivedFields?: ArchivedProgressField[];
  createdAt: string;
  updatedAt: string;
}
```

Rows store dynamic values:

```ts
interface ProgressRow {
  id: string;
  title: string;
  status: string;
  progress?: number;
  owner?: string;
  values: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

## Built-In Template Examples

| Template | Sheet title | Example columns |
| --- | --- | --- |
| `software-desktop-app` | Desktop App Development Progress | Feature, Phase, Status, Owner, Priority, Spec, Test Coverage, Release Channel |
| `software-backend-api` | Backend API Development Progress | Endpoint, Service, Status, Owner, Contract, Migration, Test Coverage, Deploy Env |
| `hardware-rd` | Hardware R&D Progress | Module, EVT/DVT/PVT Stage, Prototype Rev, BOM Status, Lab Test Status, Risk, Target Date |
| `industrial-design` | Industrial Design Progress | Concept, Design Stage, CMF, Prototype, Review Status, Vendor, Decision Owner |
| `project-operations` | Project Operations Progress | Workstream, Operational Status, Owner, Dependency, SLA/Risk, Next Checkpoint |
| `marketing-campaign` | Marketing Campaign Progress | Campaign Asset, Channel, Funnel Stage, Approval Status, Launch Date, KPI |
| `content-production` | Content Production Progress | Content Item, Format, Draft Status, Editor, Review Round, Publish Channel |
| `qa-validation` | QA Validation Progress | Test Area, Test Type, Environment, Case Count, Pass Rate, Defect Count, Retest Date |
| `construction-field` | Construction Field Progress | Work Package, Trade, Permit, Inspection, Site Owner, Safety Status |
| `procurement-vendor` | Procurement Progress | Package, Vendor, RFQ Status, Quote Due, PO Status, Lead Time, Delivery Risk |

## Initialization UX

Project initialization changes from a single button action to a guarded flow:

```text
Project row Initialize
  -> Template Picker
  -> Select one or more discipline sheets
  -> Preview columns and status options
  -> Create / Merge / Overwrite decision
  -> AI scan or scaffold
  -> Write manifest and sheet configs
  -> Open Project Progress with selected sheets
```

The first implementation may default to one selected sheet, but the model must
allow multiple sheets during initialization.

## Dashboard UX

- Sidebar/nav label should become `Project Progress` or similar.
- The table surface shows sheet tabs or a sheet selector.
- The visible sheet title comes from `ProgressSheetConfig.sheetTitle`.
- The current software sheet title should become `Desktop App Development
  Progress` rather than generic `Development Progress`.
- Table columns are generated from the active sheet config.
- Existing TanStack table preferences should be scoped by sheet id.

## Backend Connector Profiles

F55 updates the backend direction from "Supabase Cloud" to
"Supabase-compatible control plane".

```ts
type BackendProfile =
  | { mode: 'local-files'; enabled: false }
  | { mode: 'local-docker-supabase'; url: string; anonKeyRef: string }
  | { mode: 'self-hosted-supabase'; url: string; anonKeyRef: string }
  | { mode: 'supabase-cloud'; url: string; anonKeyRef: string };
```

Rules:

- `local-files` remains valid and must not require Docker or sign-in.
- `local-docker-supabase` is for personal, PoC, restricted-network, and local
  team usage.
- `self-hosted-supabase` is for company-owned infrastructure.
- `supabase-cloud` is for managed SaaS collaboration.
- Renderer-safe profile data may include URL and anon key.
- Service-role key, JWT secret, and database password must never enter the
  renderer. They belong in OS Keychain, local ops env files, or server-only
  backend contexts.

## Supabase Local Docker Scope

The repository already contains a partial self-hosted scaffold:

- `infra/supabase/docker-compose.pm-system.yml`
- `infra/supabase/migrations/0001_pm_core.sql`
- `infra/supabase/seed.sql`
- `scripts/pm-system.mjs`
- `docs/engineering/pm-system-installer.md`

F55 requires a follow-up infrastructure slice to make local Docker Supabase
usable for authenticated clients:

- add Auth, REST, Storage, and Realtime services or explicitly document why a
  smaller stack is selected;
- configure Kong routes;
- provide migration runner behavior for existing volumes;
- add health checks for required services;
- add connector profile read/write flow;
- keep install/doctor dry-run side-effect-free;
- keep generated secrets ignored and redacted.

## Architecture Impact

Likely affected files:

- `lib/types/index.ts`
- `schema/project-manager.schema.json`
- `lib/storage/migrate.ts`
- `lib/storage/createProjectScaffold.ts`
- `lib/storage/dashboardLayout.ts`
- `lib/bridge/index.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/default.json`
- `app/ui/views/ProjectsView.tsx`
- `app/ui/MainClient.tsx`
- `app/project-progress-dashboard/ProjectProgressClient.tsx`
- `app/project-progress-dashboard/_lib/columns.tsx`
- `app/project-progress-dashboard/_components/PhaseTable.tsx`
- `docs/architecture/ADR-016-supabase-cloud-control-plane-and-developer-runner.md`
- `docs/engineering/pm-system-installer.md`
- `docs/engineering/storage-and-schema.md`
- `docs/guides/features/dashboard.md`

## ADR Requirements

This feature needs an ADR update or replacement because it changes two
strategic decisions:

- ADR-007's software-oriented project-progress phase model becomes one
  template among many, not the product boundary.
- ADR-016 should become a Supabase-compatible control-plane decision, not a
  Supabase Cloud-only direction.

## Success Metrics

- A new project can initialize with a selected discipline sheet.
- A new project can initialize with multiple discipline sheets.
- The manifest records sheet refs and each sheet has its own config.
- The dashboard renders sheet titles from config rather than hard-coded
  Development Progress copy.
- Existing software projects migrate to a Desktop App Development Progress
  sheet without losing feature data.
- Switching templates preserves unmapped values.
- Custom templates can be saved and reused.
- Local-only mode works without Supabase.
- Local Docker Supabase can be installed, started, diagnosed, and connected
  without sending data to the cloud.
- Self-hosted and cloud profile modes share the same app connector interface.

