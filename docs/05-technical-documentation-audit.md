# DevPilot Technical Documentation Audit

Version: v0.1  
Date: 2026-05-15  
Status: Active

---

## English Version

## 1. Purpose

This document tracks the technical documentation gaps found during the May 2026 mid-project review and records which documents now own each topic.

## 2. Current Coverage

| Area | Status | Owner Document |
| --- | --- | --- |
| Product scope and requirements | Covered | [02-prd.md](./02-prd.md) |
| User workflows | Covered | [01-user-scenarios.md](./01-user-scenarios.md) |
| System architecture | Updated | [Architecture.md](./Architecture.md) |
| Architecture decisions | Updated | [architecture/README.md](./architecture/README.md) |
| UI design system | Covered | [DESIGN.md](../DESIGN.md), [shared-ai-desktop-style.md](./design/shared-ai-desktop-style.md) |
| Runtime bridge contract | Added | [engineering/runtime-bridge.md](./engineering/runtime-bridge.md) |
| Storage and schema migration | Added | [engineering/storage-and-schema.md](./engineering/storage-and-schema.md) |
| Ingestion pipeline | Added | [engineering/ingestion-pipeline.md](./engineering/ingestion-pipeline.md) |
| Security and secrets | Added | [engineering/security-and-secrets.md](./engineering/security-and-secrets.md) |
| Verification and release checks | Added | [engineering/verification-runbook.md](./engineering/verification-runbook.md) |

## 3. Gaps Closed in This Pass

1. Added a dedicated engineering documentation index under `docs/engineering/`.
2. Documented the Tauri bridge command and event contract instead of leaving it only in source comments.
3. Documented schema v2 migration entry points and storage namespaces.
4. Documented ingestion behavior, including Markdown parsing and current fallback boundaries.
5. Documented secret storage rules for Tauri and browser development modes.
6. Documented the verification command order and release handoff checks.
7. Updated the ADR index so ADR-006 is visible from the architecture entry point.

## 4. Remaining Documentation Gaps

| Priority | Gap | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| P1 | Execution allowlist and approval policy | `spawn_agent` can execute local commands; command boundaries need a product and technical contract before broader use. | New ADR plus update to [runtime-bridge.md](./engineering/runtime-bridge.md) |
| P1 | Durable run-history storage | Active and completed run history still has browser and local state paths; persistence rules should be formalized before sync. | [storage-and-schema.md](./engineering/storage-and-schema.md) |
| P1 | Real DOCX and XLSX parser contract | The product promises Word and Excel ingestion, but the durable parser shape and failure reporting need a stronger spec. | [ingestion-pipeline.md](./engineering/ingestion-pipeline.md) |
| P2 | Release packaging checklist | Tauri signing, updater, platform matrix, and artifact naming are not yet documented. | New `docs/engineering/release-packaging.md` |
| P2 | GitHub sync cache and rate-limit policy | GitHub polling exists, but cache TTL, retry, and rate-limit behavior need a formal policy. | New `docs/engineering/github-sync.md` |
| P2 | Test strategy matrix | Unit, component, bridge, Rust, and visual checks need an explicit coverage map. | [verification-runbook.md](./engineering/verification-runbook.md) |

## 5. Maintenance Rule

When code changes touch bridge commands, schema fields, ingestion behavior, secret handling, sessions, GitHub sync, or release checks, update the matching engineering document in the same change set.

---

## 中文版本

## 1. 目的

本文件記錄 2026-05 專案中途盤點時發現的技術文件缺口，並標明目前由哪份文件負責。

## 2. 目前覆蓋狀態

| 區域 | 狀態 | 負責文件 |
| --- | --- | --- |
| 產品範圍與需求 | 已有 | [02-prd.md](./02-prd.md) |
| 使用者工作流 | 已有 | [01-user-scenarios.md](./01-user-scenarios.md) |
| 系統架構 | 已更新 | [Architecture.md](./Architecture.md) |
| 架構決策 | 已更新 | [architecture/README.md](./architecture/README.md) |
| UI 設計系統 | 已有 | [DESIGN.md](../DESIGN.md), [shared-ai-desktop-style.md](./design/shared-ai-desktop-style.md) |
| Runtime bridge contract | 已新增 | [engineering/runtime-bridge.md](./engineering/runtime-bridge.md) |
| Storage 與 schema migration | 已新增 | [engineering/storage-and-schema.md](./engineering/storage-and-schema.md) |
| Ingestion pipeline | 已新增 | [engineering/ingestion-pipeline.md](./engineering/ingestion-pipeline.md) |
| Security 與 secrets | 已新增 | [engineering/security-and-secrets.md](./engineering/security-and-secrets.md) |
| Verification 與 release checks | 已新增 | [engineering/verification-runbook.md](./engineering/verification-runbook.md) |

## 3. 本輪已補齊缺口

1. 新增 `docs/engineering/` 工程文件入口。
2. 補上 Tauri bridge command 與 event contract，不再只靠程式註解。
3. 補上 schema v2 migration 入口與 storage namespace 規則。
4. 補上 ingestion 行為，包括 Markdown parsing 與目前 fallback 邊界。
5. 補上 Tauri 與 browser development mode 的 secret storage 規則。
6. 補上驗證指令順序與 release handoff checks。
7. 修正 ADR index，讓 ADR-006 能從架構入口找到。

## 4. 尚待補強技術文件

| 優先級 | 缺口 | 影響 | 建議負責文件 |
| --- | --- | --- | --- |
| P1 | Execution allowlist 與 approval policy | `spawn_agent` 可執行本機命令；擴大使用前需要明確命令邊界。 | 新 ADR，並更新 [runtime-bridge.md](./engineering/runtime-bridge.md) |
| P1 | Durable run-history storage | Active 與 completed run history 仍有 browser 與 local state 路徑；同步前要先定義持久化規則。 | [storage-and-schema.md](./engineering/storage-and-schema.md) |
| P1 | 真實 DOCX 與 XLSX parser contract | 產品承諾 Word 與 Excel 匯入，但正式 parser shape 與失敗回報規格仍需加強。 | [ingestion-pipeline.md](./engineering/ingestion-pipeline.md) |
| P2 | Release packaging checklist | Tauri signing、updater、platform matrix、artifact naming 尚未文件化。 | 新增 `docs/engineering/release-packaging.md` |
| P2 | GitHub sync cache 與 rate-limit policy | GitHub polling 已存在，但 cache TTL、retry、rate-limit 還沒有正式規則。 | 新增 `docs/engineering/github-sync.md` |
| P2 | Test strategy matrix | Unit、component、bridge、Rust、visual checks 需要明確覆蓋矩陣。 | [verification-runbook.md](./engineering/verification-runbook.md) |

## 5. 維護規則

只要程式碼改到 bridge commands、schema fields、ingestion behavior、secret handling、sessions、GitHub sync 或 release checks，同一批變更就要同步更新對應的 engineering document。
