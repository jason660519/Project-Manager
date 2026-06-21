# Project Manager Engineering Documentation

> Status: Active  
> Last updated: 2026-06-21  
> Audience: AI engineers and maintainers

---

## English Version

## 1. Purpose

This folder contains operational engineering documentation for Project Manager. Product documents explain what the app should do; these documents explain how the current implementation is wired and what must be kept stable when changing it.

## 2. Read Order

1. [../file-naming-standards.md](../file-naming-standards.md)
2. [runtime-bridge.md](./runtime-bridge.md)
3. [storage-and-schema.md](./storage-and-schema.md)
4. [domain-glossary.md](./domain-glossary.md) — product/engineering vocabulary and SSOT pointers
5. [supabase-db-design-standard.md](./supabase-db-design-standard.md) — when backend mode is not `local-files`
6. [supabase-cloud-auth.md](./supabase-cloud-auth.md) — browser auth, workspace session, cloud read query contracts
7. [ingestion-pipeline.md](./ingestion-pipeline.md)
8. [security-and-secrets.md](./security-and-secrets.md)
9. [table-standards.md](./table-standards.md)
10. [document-classification-standard.md](./document-classification-standard.md)
11. [documentation-site-sync.md](./documentation-site-sync.md)
12. [hermes-agent-plugin.md](./hermes-agent-plugin.md)
13. [openclaw-plugin.md](./openclaw-plugin.md)
14. [verification-runbook.md](./verification-runbook.md)
15. [ai-sdks-store.md](./ai-sdks-store.md)
16. [multi-ai-config.md](./multi-ai-config.md)

## 3. Ownership Map

| Topic | Primary Files | Document |
| --- | --- | --- |
| Tauri commands, browser fallbacks, event contracts | `src-tauri/src/lib.rs`, `lib/bridge/index.ts`, `app/api/*` | [runtime-bridge.md](./runtime-bridge.md) |
| Project list, selected project, schema migration | `lib/storage/*`, `schema/project-manager.schema.json`, `config/samples/*` | [storage-and-schema.md](./storage-and-schema.md) |
| Product/engineering vocabulary (workspace, project, roles, runners) | `lib/auth/permissions.ts`, `lib/types/index.ts`, ADR-016 | [domain-glossary.md](./domain-glossary.md) |
| Supabase Postgres schema, RLS, migrations | `infra/supabase/migrations/*`, `docker/supabase/*` | [supabase-db-design-standard.md](./supabase-db-design-standard.md) |
| Supabase browser auth, workspace session, cloud read helpers | `lib/auth/supabaseAuthSession.ts`, `lib/auth/workspaceSession.ts`, `lib/auth/*`, `app/login/*`, `app/auth/*` | [supabase-cloud-auth.md](./supabase-cloud-auth.md) |
| Markdown import and AI-assisted spec import | `lib/ingestion/*`, `app/ui/views/IngestionView.tsx` | [ingestion-pipeline.md](./ingestion-pipeline.md) |
| API keys, provider keys, GitHub token, API call boundary | `lib/storage/plugins.ts`, `lib/bridge/index.ts`, `src-tauri/src/lib.rs`, `app/api/anthropic/route.ts` | [security-and-secrets.md](./security-and-secrets.md) |
| Table interaction, label contracts, sorting behavior, dashboard document-link cells, workstation viewport rules | `app/project-progress-dashboard/_components/PhaseTable.tsx`, `app/project-progress-dashboard/_lib/columns.tsx`, `app/project-progress-dashboard/_lib/pathLinks.tsx`, `app/ui/views/Plugins/PluginsHubView.tsx`, `app/ui/views/Plugins/_shared/IntegrationsTable.tsx`, `components/table/TableCore.tsx` | [table-standards.md](./table-standards.md) |
| Document classification, public/internal/restricted gates, and public publish policy | `scripts/sync-documentation-site.mjs`, `docs/**/*.md` frontmatter | [document-classification-standard.md](./document-classification-standard.md) |
| Static documentation website sync, generated routes, and publication classification metadata | `scripts/sync-documentation-site.mjs`, `lib/generated/documentation-site-internal.ts`, `lib/generated/documentation-site-public.ts`, `app/documentation/[[...slug]]/page.tsx`, `app/ui/views/DocumentationView.tsx` | [documentation-site-sync.md](./documentation-site-sync.md) |
| Project-scoped Hermes Agent install and plugin toggle | `scripts/install-hermes-agent.sh`, `scripts/hermes-agent.sh`, `.project-manager/vendor/hermes-agent/`, `lib/storage/plugins.ts` | [hermes-agent-plugin.md](./hermes-agent-plugin.md) |
| Project-scoped OpenClaw install, gateway, update, rollback, and plugin toggle | `scripts/install-openclaw.sh`, `scripts/openclaw.sh`, `scripts/update-openclaw.sh`, `scripts/rollback-openclaw.sh`, `.project-manager/vendor/openclaw/`, `lib/storage/plugins.ts` | [openclaw-plugin.md](./openclaw-plugin.md) |
| Pre-handoff checks and release verification | `package.json`, `scripts/*`, `src-tauri/Cargo.toml` | [verification-runbook.md](./verification-runbook.md) |
| AI SDK parameter config store, normalization, validation | `lib/aiSdks/*`, `app/ui/views/AiSdksView.tsx`, `app/ui/views/AiSdks/*`, `.project-manager/ai-sdks.json` | [ai-sdks-store.md](./ai-sdks-store.md) |
| Multi-AI agent instruction files (SSOT + thin shells), Tier-1/2/3 model, drift check | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/*.mdc`, `.claude/local.md`, `scripts/check-agents-drift.mjs` | [multi-ai-config.md](./multi-ai-config.md) |

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
4. [domain-glossary.md](./domain-glossary.md) — 產品/工程詞彙與 SSOT 指標
5. [supabase-db-design-standard.md](./supabase-db-design-standard.md) — backend mode 不是 `local-files` 時
6. [supabase-cloud-auth.md](./supabase-cloud-auth.md) — 瀏覽器 auth、工作區 session、雲端唯讀查詢契約
7. [ingestion-pipeline.md](./ingestion-pipeline.md)
8. [security-and-secrets.md](./security-and-secrets.md)
9. [table-standards.md](./table-standards.md)
10. [document-classification-standard.md](./document-classification-standard.md)
11. [documentation-site-sync.md](./documentation-site-sync.md)
12. [hermes-agent-plugin.md](./hermes-agent-plugin.md)
13. [openclaw-plugin.md](./openclaw-plugin.md)
14. [verification-runbook.md](./verification-runbook.md)
15. [ai-sdks-store.md](./ai-sdks-store.md)
16. [multi-ai-config.md](./multi-ai-config.md)

## 3. 責任對照

| 主題 | 主要檔案 | 文件 |
| --- | --- | --- |
| Tauri commands、browser fallbacks、event contracts | `src-tauri/src/lib.rs`, `lib/bridge/index.ts`, `app/api/*` | [runtime-bridge.md](./runtime-bridge.md) |
| Project list、selected project、schema migration | `lib/storage/*`, `schema/project-manager.schema.json`, `config/samples/*` | [storage-and-schema.md](./storage-and-schema.md) |
| 產品/工程詞彙（workspace、project、roles、runners） | `lib/auth/permissions.ts`, `lib/types/index.ts`, ADR-016 | [domain-glossary.md](./domain-glossary.md) |
| Supabase Postgres schema、RLS、migrations | `infra/supabase/migrations/*`, `docker/supabase/*` | [supabase-db-design-standard.md](./supabase-db-design-standard.md) |
| Supabase 瀏覽器 auth、工作區 session、雲端唯讀 helper | `lib/auth/supabaseAuthSession.ts`, `lib/auth/workspaceSession.ts`, `lib/auth/*`, `app/login/*`, `app/auth/*` | [supabase-cloud-auth.md](./supabase-cloud-auth.md) |
| Markdown import 與 AI-assisted spec import | `lib/ingestion/*`, `app/ui/views/IngestionView.tsx` | [ingestion-pipeline.md](./ingestion-pipeline.md) |
| API keys、provider keys、GitHub token、API call boundary | `lib/storage/plugins.ts`, `lib/bridge/index.ts`, `src-tauri/src/lib.rs`, `app/api/anthropic/route.ts` | [security-and-secrets.md](./security-and-secrets.md) |
| Table 互動、label contracts、排序行為、dashboard 文件連結欄位與 workstation 視窗版面規則 | `app/project-progress-dashboard/_components/PhaseTable.tsx`, `app/project-progress-dashboard/_lib/columns.tsx`, `app/project-progress-dashboard/_lib/pathLinks.tsx`, `app/ui/views/Plugins/PluginsHubView.tsx`, `app/ui/views/Plugins/_shared/IntegrationsTable.tsx`, `components/table/TableCore.tsx` | [table-standards.md](./table-standards.md) |
| 文件分類、public/internal/restricted gates 與 public publish policy | `scripts/sync-documentation-site.mjs`, `docs/**/*.md` frontmatter | [document-classification-standard.md](./document-classification-standard.md) |
| 靜態 Documentation website sync、generated routes 與 publication classification metadata | `scripts/sync-documentation-site.mjs`, `lib/generated/documentation-site-internal.ts`, `lib/generated/documentation-site-public.ts`, `app/documentation/[[...slug]]/page.tsx`, `app/ui/views/DocumentationView.tsx` | [documentation-site-sync.md](./documentation-site-sync.md) |
| Project-scoped Hermes Agent 安裝與 plugin toggle | `scripts/install-hermes-agent.sh`, `scripts/hermes-agent.sh`, `.project-manager/vendor/hermes-agent/`, `lib/storage/plugins.ts` | [hermes-agent-plugin.md](./hermes-agent-plugin.md) |
| Project-scoped OpenClaw 安裝、gateway、更新、回滾與 plugin toggle | `scripts/install-openclaw.sh`, `scripts/openclaw.sh`, `scripts/update-openclaw.sh`, `scripts/rollback-openclaw.sh`, `.project-manager/vendor/openclaw/`, `lib/storage/plugins.ts` | [openclaw-plugin.md](./openclaw-plugin.md) |
| 交付前檢查與 release verification | `package.json`, `scripts/*`, `src-tauri/Cargo.toml` | [verification-runbook.md](./verification-runbook.md) |
| AI SDK 參數設定儲存、正規化與驗證 | `lib/aiSdks/*`, `app/ui/views/AiSdksView.tsx`, `app/ui/views/AiSdks/*`, `.project-manager/ai-sdks.json` | [ai-sdks-store.md](./ai-sdks-store.md) |
| 多家 AI agent 指令檔（SSOT + 薄殼）、Tier-1/2/3 模型、drift check | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/*.mdc`, `.claude/local.md`, `scripts/check-agents-drift.mjs` | [multi-ai-config.md](./multi-ai-config.md) |

## 4. 文件維護規則

只要實作變更 command signature、persisted shape、storage key、parser behavior、secret boundary 或 verification requirement，就要更新對應文件。
