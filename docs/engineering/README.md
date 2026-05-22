# Project Manager Engineering Documentation

> Status: Active  
> Last updated: 2026-05-23  
> Audience: AI engineers and maintainers

---

## English Version

## 1. Purpose

This folder contains operational engineering documentation for Project Manager. Product documents explain what the app should do; these documents explain how the current implementation is wired and what must be kept stable when changing it.

## 2. Read Order

1. [../file-naming-standards.md](../file-naming-standards.md)
2. [runtime-bridge.md](./runtime-bridge.md)
3. [storage-and-schema.md](./storage-and-schema.md)
4. [ingestion-pipeline.md](./ingestion-pipeline.md)
5. [security-and-secrets.md](./security-and-secrets.md)
6. [table-standards.md](./table-standards.md)
7. [hermes-agent-plugin.md](./hermes-agent-plugin.md)
8. [openclaw-plugin.md](./openclaw-plugin.md)
9. [verification-runbook.md](./verification-runbook.md)

## 3. Ownership Map

| Topic | Primary Files | Document |
| --- | --- | --- |
| Tauri commands, browser fallbacks, event contracts | `src-tauri/src/lib.rs`, `lib/bridge/index.ts`, `app/api/*` | [runtime-bridge.md](./runtime-bridge.md) |
| Project list, selected project, schema migration | `lib/storage/*`, `schema/project-manager.schema.json`, `config/samples/*` | [storage-and-schema.md](./storage-and-schema.md) |
| Markdown import and AI-assisted spec import | `lib/ingestion/*`, `app/ui/views/IngestionView.tsx` | [ingestion-pipeline.md](./ingestion-pipeline.md) |
| API keys, provider keys, GitHub token, API call boundary | `lib/storage/plugins.ts`, `lib/bridge/index.ts`, `src-tauri/src/lib.rs`, `app/api/anthropic/route.ts` | [security-and-secrets.md](./security-and-secrets.md) |
| Table interaction, label contracts, sorting behavior, dashboard document-link cells, workstation viewport rules | `app/project-progress-dashboard/_components/PhaseTable.tsx`, `app/project-progress-dashboard/_lib/columns.tsx`, `app/project-progress-dashboard/_lib/pathLinks.tsx`, `app/ui/views/Plugins/PluginsHubView.tsx`, `app/ui/views/Plugins/_shared/IntegrationsTable.tsx`, `components/table/TableCore.tsx` | [table-standards.md](./table-standards.md) |
| Project-scoped Hermes Agent install and plugin toggle | `scripts/install-hermes-agent.sh`, `scripts/hermes-agent.sh`, `.project-manager/vendor/hermes-agent/`, `lib/storage/plugins.ts` | [hermes-agent-plugin.md](./hermes-agent-plugin.md) |
| Project-scoped OpenClaw install, gateway, update, rollback, and plugin toggle | `scripts/install-openclaw.sh`, `scripts/openclaw.sh`, `scripts/update-openclaw.sh`, `scripts/rollback-openclaw.sh`, `.project-manager/vendor/openclaw/`, `lib/storage/plugins.ts` | [openclaw-plugin.md](./openclaw-plugin.md) |
| Pre-handoff checks and release verification | `package.json`, `scripts/*`, `src-tauri/Cargo.toml` | [verification-runbook.md](./verification-runbook.md) |

## 4. Documentation Rule

Update the relevant document whenever an implementation change changes a command signature, persisted shape, storage key, parser behavior, secret boundary, or verification requirement.

---

## 中文版本

## 1. 目的

此目錄保存 Project Manager 的工程技術文件。產品文件說明 app 應該做什麼；本目錄說明目前實作如何接線，以及修改時哪些 contract 不能破壞。

## 2. 建議閱讀順序

1. [../file-naming-standards.md](../file-naming-standards.md)
2. [runtime-bridge.md](./runtime-bridge.md)
3. [storage-and-schema.md](./storage-and-schema.md)
4. [ingestion-pipeline.md](./ingestion-pipeline.md)
5. [security-and-secrets.md](./security-and-secrets.md)
6. [table-standards.md](./table-standards.md)
7. [hermes-agent-plugin.md](./hermes-agent-plugin.md)
8. [openclaw-plugin.md](./openclaw-plugin.md)
9. [verification-runbook.md](./verification-runbook.md)

## 3. 責任對照

| 主題 | 主要檔案 | 文件 |
| --- | --- | --- |
| Tauri commands、browser fallbacks、event contracts | `src-tauri/src/lib.rs`, `lib/bridge/index.ts`, `app/api/*` | [runtime-bridge.md](./runtime-bridge.md) |
| Project list、selected project、schema migration | `lib/storage/*`, `schema/project-manager.schema.json`, `config/samples/*` | [storage-and-schema.md](./storage-and-schema.md) |
| Markdown import 與 AI-assisted spec import | `lib/ingestion/*`, `app/ui/views/IngestionView.tsx` | [ingestion-pipeline.md](./ingestion-pipeline.md) |
| API keys、provider keys、GitHub token、API call boundary | `lib/storage/plugins.ts`, `lib/bridge/index.ts`, `src-tauri/src/lib.rs`, `app/api/anthropic/route.ts` | [security-and-secrets.md](./security-and-secrets.md) |
| Table 互動、label contracts、排序行為、dashboard 文件連結欄位與 workstation 視窗版面規則 | `app/project-progress-dashboard/_components/PhaseTable.tsx`, `app/project-progress-dashboard/_lib/columns.tsx`, `app/project-progress-dashboard/_lib/pathLinks.tsx`, `app/ui/views/Plugins/PluginsHubView.tsx`, `app/ui/views/Plugins/_shared/IntegrationsTable.tsx`, `components/table/TableCore.tsx` | [table-standards.md](./table-standards.md) |
| Project-scoped Hermes Agent 安裝與 plugin toggle | `scripts/install-hermes-agent.sh`, `scripts/hermes-agent.sh`, `.project-manager/vendor/hermes-agent/`, `lib/storage/plugins.ts` | [hermes-agent-plugin.md](./hermes-agent-plugin.md) |
| Project-scoped OpenClaw 安裝、gateway、更新、回滾與 plugin toggle | `scripts/install-openclaw.sh`, `scripts/openclaw.sh`, `scripts/update-openclaw.sh`, `scripts/rollback-openclaw.sh`, `.project-manager/vendor/openclaw/`, `lib/storage/plugins.ts` | [openclaw-plugin.md](./openclaw-plugin.md) |
| 交付前檢查與 release verification | `package.json`, `scripts/*`, `src-tauri/Cargo.toml` | [verification-runbook.md](./verification-runbook.md) |

## 4. 文件維護規則

只要實作變更 command signature、persisted shape、storage key、parser behavior、secret boundary 或 verification requirement，就要更新對應文件。
