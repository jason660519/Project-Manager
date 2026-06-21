# Table Sheet Inventory

> Status: Generated from current source
> Generated at: 2026-06-21T19:36:55.793Z
> Source command: `npm run table:sheet:audit -- --write`

This report is source-driven. Do not use old hand-maintained coverage snapshots as completion proof.

## Summary

- Surfaces scanned: 32
- Basic table sheets: 9
- Blocking findings: 0
- Warnings: 0

## Inventory

| Surface | Module | Route | Classification | Implementation | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `app/ai_assistants/AIAssistantsConsoleClient.tsx` | AI Assistants | /ai_assistants | sheet-wrapper (inferred) | WorkstationFrame + BottomSheetTabs + HTML table | pass | Current static audit passed |
| `app/ui/views/AiSdks/AiSdkProviderSheet.tsx` | AI SDKs | /ai-sdks | basic (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/AiSdksView.tsx` | AI SDKs | /ai-sdks | sheet-wrapper (inferred) | WorkstationFrame + BottomSheetTabs | pass | Current static audit passed |
| `app/ui/views/Engineers/AbilityToolsTable.tsx` | Engineers | /engineers | simple (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/Engineers/AiEngineersTable.tsx` | Engineers | /engineers | simple (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/EngineersView.tsx` | Engineers | /engineers | sheet-wrapper (inferred) | WorkstationFrame + BottomSheetTabs | pass | Current static audit passed |
| `app/ui/views/Plugins/_shared/IntegrationsTable.tsx` | Integrations Hub | /integrations-hub/system_installed_apps | basic (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/Plugins/CapabilitySheetView.tsx` | Integrations Hub | /integrations-hub/system_installed_apps | read-only/detail (inferred) | HTML table | pass | Current static audit passed |
| `app/ui/views/Plugins/ConnectSheet.tsx` | Integrations Hub | /integrations-hub/system_installed_apps | read-only/detail (inferred) | HTML table | pass | Current static audit passed |
| `app/ui/views/Plugins/PluginsHubView.tsx` | Integrations Hub | /integrations-hub/system_installed_apps | sheet-wrapper (inferred) | WorkstationFrame + BottomSheetTabs | pass | Current static audit passed |
| `app/ui/views/Keys/CodingAgentCandidateTable.tsx` | Keys | /keys | basic (comment) | TanStack + DataTableShell | pass | Current static audit passed |
| `app/ui/views/Keys/KeysProviderTable.tsx` | Keys | /keys | basic (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/Keys/LlmArenaDetailSheet.tsx` | Keys | /keys | read-only/detail (inferred) | HTML table | pass | Current static audit passed |
| `app/ui/views/Keys/LlmArenaMatrixTable.tsx` | Keys | /keys | basic (comment) | TanStack + DataTableShell + HTML table | pass | Current static audit passed |
| `app/ui/views/Keys/VlmArenaMatrixTable.tsx` | Keys | /keys | basic (comment) | TanStack + DataTableShell + HTML table | pass | Current static audit passed |
| `app/ui/views/KeysView.tsx` | Keys | /keys | sheet-wrapper (inferred) | WorkstationFrame + BottomSheetTabs | pass | Current static audit passed |
| `app/ui/DashboardClient.tsx` | Other | /features | simple-wrapper (inferred) | TableCore | pass | Current static audit passed |
| `app/ui/views/FeaturesView.tsx` | Other | /features | simple-wrapper (inferred) | TableCore | pass | Current static audit passed |
| `app/ui/views/ProgressTemplates/TemplateColumnsSheet.tsx` | Other | n/a | simple (comment) | HTML table | pass | Current static audit passed |
| `app/ui/views/ProgressTemplatesSettingView.tsx` | Other | n/a | simple (comment) | WorkstationFrame + BottomSheetTabs | pass | Current static audit passed |
| `app/ui/views/Settings/LlmRouterHealthPanel.tsx` | Other | n/a | simple (comment) | HTML table | pass | Current static audit passed |
| `app/project-progress-dashboard/_components/IssuesTab.tsx` | Project Progress Dashboard | /project-progress-dashboard | basic (comment) | HTML table | pass | Current static audit passed |
| `app/project-progress-dashboard/_components/PhaseTable.tsx` | Project Progress Dashboard | /project-progress-dashboard | basic (comment) | HTML table | pass | Current static audit passed |
| `app/project-progress-dashboard/_components/SheetTabs.tsx` | Project Progress Dashboard | /project-progress-dashboard | sheet-tab-primitive (inferred) | BottomSheetTabs | pass | Current static audit passed |
| `app/project-progress-dashboard/ProjectProgressClient.tsx` | Project Progress Dashboard | /project-progress-dashboard | sheet-wrapper (inferred) | WorkstationFrame + BottomSheetTabs | pass | Current static audit passed |
| `app/ui/views/ProjectsView.tsx` | Projects | /project-progress-dashboard | basic (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/KeyboardShortcutsView.tsx` | Settings | /settings | read-only (inferred) | HTML table | pass | Current static audit passed |
| `app/ui/views/SettingsView.tsx` | Settings | /settings | simple (inferred) | WorkstationFrame + BottomSheetTabs + HTML table | pass | Current static audit passed |
| `components/table/datasheet/DataTableShell.tsx` | Shared table primitive | n/a | shared-primitive (inferred) | DataTableShell + HTML table | pass | Current static audit passed |
| `components/table/datasheet/index.ts` | Shared table primitive | n/a | shared-primitive (inferred) | DataTableShell | pass | Current static audit passed |
| `components/table/TableCore.tsx` | Shared table primitive | n/a | simple (comment) | TanStack + TableCore + HTML table | pass | Current static audit passed |
| `app/ui/views/XmuxView.tsx` | Workspace | n/a | workspace-tabs (inferred) | BottomSheetTabs | pass | Current static audit passed |

## Blocking Findings

None.

## Warnings

None.

## Static Test Report

- Inventory source: 32 source-detected table/sheet surfaces under `app/` and `components/`.
- Basic sheet checks: col-id, table search/filter state, freeze columns, resizable columns, hidden columns recovery, visible table scrollbar, empty or filtered-empty state.
- Sheet wrapper checks: WorkstationFrame page frame, bottomTabs slot, bottom sheet tabs, reorderable sheet tabs, table-owned scrolling.
- Routes requiring UI smoke when changed: /ai-sdks, /ai_assistants, /engineers, /features, /integrations-hub/system_installed_apps, /keys, /project-progress-dashboard, /settings.

## Required Dynamic Verification

Static audit does not replace UI smoke. For changed table routes, run:

```bash
npm run verify:dev-issues -- --routes /changed-route[,/another-route]
npm run verify:baseline
```
