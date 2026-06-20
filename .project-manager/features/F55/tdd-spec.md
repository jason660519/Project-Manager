# F55 TDD Specification

## Strategy

F55 must be tested from storage outward. The main risk is data loss during
schema migration or template switching, followed by UI routes accidentally
assuming the old software-only Development Progress columns.

## Test Layers

| Layer | Target | Purpose |
| --- | --- | --- |
| Unit | `lib/progress-sheets/templates.ts` | Built-in template registry validates unique ids, stable columns, and supported field types. |
| Unit | `lib/progress-sheets/sheetConfig.ts` | Create sheet config from template snapshot without mutating the source template. |
| Unit | `lib/progress-sheets/templateMapping.ts` | Template switch preserves unmapped values and records archived fields. |
| Migration | `lib/storage/migrate.ts` | v10 configs migrate to v11 manifest with software sheet ref and no feature data loss. |
| Schema | `schema/project-manager.schema.json` | Manifest and sheet refs validate; invalid sheet refs fail clearly. |
| Storage | `lib/storage/createProjectScaffold.ts` | Initialize scaffold accepts selected sheet templates and writes manifest-safe config. |
| Bridge/Rust | `src-tauri/src/lib.rs` | Initialize creates `.project-manager/progress-sheets/<sheetId>/config.json` and rejects unsafe paths. |
| Component | `app/ui/views/ProjectsView.tsx` | Initialize opens template picker, previews columns, and supports multi-select. |
| Component | `app/project-progress-dashboard/ProjectProgressClient.tsx` | Dashboard renders sheet title and table columns from active sheet config. |
| Component | `app/project-progress-dashboard/_components/PhaseTable.tsx` | Dynamic cell editors render by field type. |
| Unit | `lib/backend-profiles/*` | Backend profile modes normalize local-files, local Docker, self-hosted, and cloud profiles. |
| Unit | `infra/supabase/*` | Local Docker plan includes Auth/REST/Storage/Realtime readiness or explicit blocked status. |
| Manual E2E | `/project-progress-dashboard`, Projects sheet, login/backend settings | Initialize, switch sheets, save custom template, and connect local backend with zero dev overlay errors. |

## Required Scenarios

### S1 Migration - Existing Software Project

Given a schema v10 project with `features[]`  
When migration runs to v11  
Then `.project-manager/config.json` includes one progress sheet ref for
`software-desktop-app`  
And existing feature ids, status, progress, notes, paths, and timestamps remain
unchanged  
And no hardware/marketing/QA fake data is invented.

### S2 Create Sheet From Template

Given the `hardware-rd` built-in template  
When a sheet config is created  
Then the result has its own `templateSnapshot`, column list, status options,
timestamps, and empty rows  
And changing the built-in template object in memory cannot mutate the created
sheet config.

### S3 Initialize Multiple Sheets

Given a local project with no dashboard config  
When the user selects `software-desktop-app` and `qa-validation`  
Then initialization writes:

```text
.project-manager/config.json
.project-manager/progress-sheets/software-desktop-app/config.json
.project-manager/progress-sheets/qa-validation/config.json
```

And the manifest points to both sheet config paths.

### S4 Template Switch Preserves Data

Given a sheet has row values for `prototypeRev`, `bomStatus`, and `risk`  
When the user switches to a template without `bomStatus`  
Then `bomStatus` remains in archived or unmapped values  
And no row loses the original value.

### S5 Dynamic Dashboard Columns

Given a project has active sheet `marketing-campaign`  
When the dashboard loads  
Then it shows `Marketing Campaign Progress`  
And columns are campaign-specific  
And no software-only columns such as `Deploy Status` appear unless the template
defines them.

### S6 Backend Profile Local Files

Given backend profile mode is `local-files`  
When the app starts  
Then login/Supabase is not required for local project work  
And `.project-manager/` remains writable through the existing Tauri bridge.

### S7 Backend Profile Local Docker Supabase

Given backend profile mode is `local-docker-supabase`  
When doctor runs  
Then it checks Docker runtime, ports, Auth, Postgres, REST, Storage, Realtime,
Kong routes, migrations, and secret redaction  
And dry-run doctor does not mutate files, volumes, containers, or secrets.

### S8 Secret Boundary

Given a self-hosted or cloud backend profile exists  
When renderer-safe settings are loaded  
Then only profile id, label, mode, URL, and anon key reference/value are exposed  
And service-role key, JWT secret, and database password are never returned to
renderer code.

## Verification Commands

Focused commands will be defined per implementation slice. Full completion
requires:

```bash
npm run verify:baseline
```

UI slices additionally require:

```bash
npm run dev
npm run verify:dev-issues -- --routes /project-progress-dashboard
```

Manual smoke must use Chrome, Safari, or Tauri, not only an embedded browser.

