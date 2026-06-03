# Table Sheet Inventory

> Status: Generated from current source
> Generated at: 2026-06-03T06:46:09.506Z
> Source command: `npm run table:sheet:audit -- --write`

This report is source-driven. Do not use old hand-maintained coverage snapshots as completion proof.

## Summary

- Surfaces scanned: 22
- Basic table sheets: 9
- Blocking findings: 0
- Warnings: 0

## Inventory

| Surface | Module | Route | Classification | Implementation | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `app/ai_assistants/AIAssistantsConsoleClient.tsx` | AI Assistants | /ai_assistants | mixed-simple (inferred) | HTML table | pass | Current static audit passed |
| `app/ui/views/AiSdks/AiSdkProviderSheet.tsx` | AI SDKs | /ai-sdks | basic (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/Engineers/AbilityToolsTable.tsx` | Engineers | /engineers | simple (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/Engineers/AiEngineersTable.tsx` | Engineers | /engineers | simple (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/Plugins/_shared/IntegrationsTable.tsx` | Integrations Hub | /integrations-hub/system_installed_apps | basic (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/Plugins/CapabilitySheetView.tsx` | Integrations Hub | /integrations-hub/system_installed_apps | read-only/detail (inferred) | HTML table | pass | Current static audit passed |
| `app/ui/views/Plugins/ConnectSheet.tsx` | Integrations Hub | /integrations-hub/system_installed_apps | read-only/detail (inferred) | HTML table | pass | Current static audit passed |
| `app/ui/views/Keys/CodingAgentCandidateTable.tsx` | Keys | /keys | basic (comment) | TanStack + DataTableShell | pass | Current static audit passed |
| `app/ui/views/Keys/KeysProviderTable.tsx` | Keys | /keys | basic (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/Keys/LlmArenaDetailSheet.tsx` | Keys | /keys | read-only/detail (inferred) | HTML table | pass | Current static audit passed |
| `app/ui/views/Keys/LlmArenaMatrixTable.tsx` | Keys | /keys | basic (comment) | TanStack + DataTableShell + HTML table | pass | Current static audit passed |
| `app/ui/views/Keys/VlmArenaMatrixTable.tsx` | Keys | /keys | basic (comment) | TanStack + DataTableShell + HTML table | pass | Current static audit passed |
| `app/ui/DashboardClient.tsx` | Other | /features | simple-wrapper (inferred) | TableCore | pass | Current static audit passed |
| `app/ui/views/FeaturesView.tsx` | Other | /features | simple-wrapper (inferred) | TableCore | pass | Current static audit passed |
| `app/project-progress-dashboard/_components/IssuesTab.tsx` | Project Progress Dashboard | /project-progress-dashboard | basic (comment) | HTML table | pass | Current static audit passed |
| `app/project-progress-dashboard/_components/PhaseTable.tsx` | Project Progress Dashboard | /project-progress-dashboard | basic (comment) | HTML table | pass | Current static audit passed |
| `app/ui/views/ProjectsView.tsx` | Projects | /project-progress-dashboard | basic (comment) | TanStack + HTML table | pass | Current static audit passed |
| `app/ui/views/KeyboardShortcutsView.tsx` | Settings | /settings | read-only (inferred) | HTML table | pass | Current static audit passed |
| `app/ui/views/SettingsView.tsx` | Settings | /settings | simple (inferred) | HTML table | pass | Current static audit passed |
| `components/table/datasheet/DataTableShell.tsx` | Shared table primitive | n/a | shared-primitive (inferred) | DataTableShell + HTML table | pass | Current static audit passed |
| `components/table/datasheet/index.ts` | Shared table primitive | n/a | shared-primitive (inferred) | DataTableShell | pass | Current static audit passed |
| `components/table/TableCore.tsx` | Shared table primitive | n/a | simple (comment) | TanStack + TableCore + HTML table | pass | Current static audit passed |

## Blocking Findings

None.

## Warnings

None.

## Required Dynamic Verification

Static audit does not replace UI smoke. For changed table routes, run:

```bash
npm run verify:dev-issues -- --routes /changed-route[,/another-route]
npm run verify:baseline
```
