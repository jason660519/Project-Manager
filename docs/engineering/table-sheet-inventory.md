# Table Sheet Inventory

> Status: Generated from current source
> Generated at: 2026-06-22T00:16:49.371Z
> Source command: `npm run table:sheet:audit -- --write`

This report is source-driven. Do not use old hand-maintained coverage snapshots as completion proof.

## Summary

- Surfaces scanned: 36
- Layer 1 inventory surfaces: 36
- Sheet routes: 4
- Sheet wrappers: 6
- Basic table sheets: 9
- Blocking findings: 0
- Warnings: 0
- Dynamic smoke routes: 12

## Three-Layer Audit Model

1. **Inventory completeness** — detects sheet routes, sheet wrappers, table primitives, and table bodies under `app/` and `components/`.
2. **Static compliance** — checks Basic Table Sheet source signals for identity, search/filter, numeric freeze, resize, hidden recovery, scroll ownership, empty states, context menus, and target highlighting.
3. **Dynamic smoke manifest** — lists routes and interactions that static analysis cannot prove and must be exercised in Chrome/Safari/Tauri.

## Inventory

| Surface | Module | Route | Classification | Implementation | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `app/ai_assistants/[sheet]/page.tsx` | AI Assistants | /ai_assistants/[sheet] | sheet-route (inferred) | sheet route | pass | Current static audit passed |
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
| `app/ui/views/Keys/LlmArenaMatrixTable.tsx` | Keys | /keys | basic (comment) | TanStack + DataTableShell | pass | Current static audit passed |
| `app/ui/views/Keys/VlmArenaMatrixTable.tsx` | Keys | /keys | basic (comment) | TanStack + DataTableShell | pass | Current static audit passed |
| `app/ui/views/KeysView.tsx` | Keys | /keys | sheet-wrapper (inferred) | WorkstationFrame + BottomSheetTabs | pass | Current static audit passed |
| `app/ai-sdks/[sheet]/page.tsx` | Other | /ai-sdks/[sheet] | sheet-route (inferred) | sheet route | pass | Current static audit passed |
| `app/integrations-hub/[sheet]/page.tsx` | Other | /integrations-hub/[sheet] | sheet-route (inferred) | sheet route | pass | Current static audit passed |
| `app/keys/[sheet]/page.tsx` | Other | /keys/[sheet] | sheet-route (inferred) | sheet route | pass | Current static audit passed |
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

- Inventory source: 36 source-detected table/sheet surfaces under `app/` and `components/`.
- Basic sheet checks: col-id, table search/filter state, freeze columns, resizable columns, hidden columns recovery, visible table scrollbar, empty or filtered-empty state.
- Company advanced checks: numeric Freeze cols control, row height resize, row or column context menu, selected row/column target highlight, column width resize, hidden row/column recovery.
- Sheet wrapper checks: WorkstationFrame page frame, bottomTabs slot, bottom sheet tabs, reorderable sheet tabs, sheet order persistence, table-owned scrolling.
- Sheet route checks: valid sheet list, static params for sheet routes, invalid sheet guard, passes canonical sheet into MainClient.
- Routes requiring UI smoke when changed: /ai-sdks, /ai-sdks/[sheet], /ai_assistants, /ai_assistants/[sheet], /engineers, /features, /integrations-hub/[sheet], /integrations-hub/system_installed_apps, /keys, /keys/[sheet], /project-progress-dashboard, /settings.

## Required Dynamic Verification

Static audit does not replace UI smoke. For each changed table-heavy route, verify:

- Sheet tabs can move left/right and persist display order.
- Column widths and row heights resize with handles and/or context-menu actions.
- Row and column right-click menus expose the expected operations.
- The active row or column target is visibly highlighted.
- Numeric `Freeze cols` freezes the leftmost N columns and keeps sticky offsets aligned.
- Hidden column/row recovery and reset controls work.
- Dev console and Next Issues badge remain clean.

```bash
npm run verify:dev-issues -- --routes /changed-route[,/another-route]
npm run verify:baseline
```
