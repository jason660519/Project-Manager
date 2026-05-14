# DevPilot File Naming and Archiving Standards

> **Created Date**: 2026-05-12
> **Created By**: GitHub Copilot
> **Last Modified**: 2026-05-15
> **Modified By**: Codex
> **Version**: 1.5
> **Document Type**: Technical Documentation
> **Alignment Scope**: Company AI App Standards, DevPilot, SayDo

---

## English Version

## 1. Core Principles

1. Use English-only filenames and directory names for source code, docs, scripts, and config.
2. Use kebab-case for Markdown docs unless a framework convention or ADR pattern requires another shape.
3. Keep docs in role-based folders so engineers know where a new document belongs before writing it.
4. Preserve meaningful history by archiving deprecated docs instead of deleting them.
5. Use repo-local ADRs for intentional deviations from company standards.
6. Keep DevPilot and SayDo aligned: the same document role should use the same folder and filename pattern in both repos.

## 2. Source File Naming

| Type | Rule | Example |
| --- | --- | --- |
| React component | PascalCase | `TaskDispatchModal.tsx` |
| TypeScript utility | camelCase | `promptBuilder.ts` |
| Hook | camelCase with `use` prefix | `useAgentStatus.ts` |
| Rust module | snake_case | `process_manager.rs` |
| Shell script | kebab-case or snake_case, keep extension | `docs-governance-check.sh` |
| Config | kebab-case or ecosystem convention | `next.config.mjs` |

## 3. Documentation Naming

| Document Type | Folder | Filename Rule | Example |
| --- | --- | --- | --- |
| Product strategy, PRD, comparison, feature plan | `docs/product/` | English kebab-case | `competitive-analysis.md` |
| Engineering spec or runbook | `docs/engineering/` | English kebab-case | `runtime-bridge.md` |
| UI/design guidance | `docs/design/` | English kebab-case | `shared-ai-desktop-style.md` |
| Architecture decision | `docs/architecture/` | `ADR-###-kebab-case.md` | `ADR-006-schema-v2-sync-fields.md` |
| Project progress or handoff report | `docs/project-process/` | `YYYY-MM-DD-kebab-case.md` | `2026-05-15-technical-documentation-update.md` |
| Deprecated document | `docs/archive/` | `archived-YYYYMMDD-kebab-case.md` | `archived-20260512-adr-tauri.md` |

## 4. Folder Conventions

DevPilot and SayDo use the same folder meanings:

```text
docs/
├── architecture/       # ADR index and ADR-### records
├── archive/            # Deprecated docs only
├── design/             # UI/design system and design briefs
├── engineering/        # Engineering specs, command contracts, runbooks
├── product/            # Product strategy, PRDs, feature plans, comparisons
└── project-process/    # Progress reports, handoffs, daily/weekly logs
```

No product, engineering, design, or architecture overview documents should live in the repo root or `docs/` root. Root-level `docs/*.md` files are reserved for repository-wide governance documents only, such as this file.

## 5. Documentation Layout

Root technical docs under `docs/` should use bilingual block layout:

```markdown
# Title

> metadata ...

## English Version

### 1. ...

## 中文版本

### 1. ...
```

Subfolder docs may be English-only when they are implementation contracts, but filenames remain English.

## 6. Archiving Policy

Archive instead of deleting when a document has historical or decision value.

Use this process:

1. Move the old file to `docs/archive/`.
2. Rename it to `archived-YYYYMMDD-kebab-case.md`.
3. Add a short note at the top explaining why it was archived and what replaces it.
4. Update all indexes and incoming links.
5. If the document was replaced by a new architecture decision, link to the ADR.

Use deletion only for generated output, empty placeholders, accidental duplicates, or files with no project value.

## 7. Root Directory Rules

Allowed root Markdown files:

| File | Purpose |
| --- | --- |
| `README.md` | Project entry point |
| `AGENTS.md` | AI engineer instructions |
| `CLAUDE.md` | Claude/Codex engineer hints |
| `DESIGN.md` | UI implementation guide |

Avoid adding new root docs. Put new material in the role-based `docs/` folder.

## 8. Quality Gates

Run before merging docs changes:

```bash
npm run docs:check
npm run standards:check
```

The DevPilot docs checker validates:

- filename safety
- repo-local docs layout and bilingual section order where applicable
- English block before Chinese block
- mixed-language heading patterns

## 9. Change History

| Date | Version | Modified By | Changes |
| --- | --- | --- | --- |
| 2026-05-15 | 1.5 | Codex | Aligned DevPilot and SayDo folder roles, archive policy, and product-doc location rules |
| 2026-05-15 | 1.4 | Codex | Added engineering, design, and project-process folders to repo convention map |
| 2026-05-12 | 1.3 | GitHub Copilot | Added governance fix script workflow |
| 2026-05-12 | 1.2 | GitHub Copilot | Refactored into separated bilingual blocks |
| 2026-05-12 | 1.1 | GitHub Copilot | Added bilingual layout policy |
| 2026-05-12 | 1.0 | GitHub Copilot | Initial version |

---

## 中文版本

## 1. 核心原則

1. Source code、docs、scripts、config 的檔案與資料夾名稱一律使用英文。
2. Markdown 文件預設使用 kebab-case，除非框架慣例或 ADR 格式另有要求。
3. 文件依角色放入固定資料夾，讓工程師在寫新文件前就知道該放哪裡。
4. 有歷史或決策價值的舊文件要歸檔，不直接刪除。
5. 若刻意偏離公司標準，使用 repo-local ADR 記錄。
6. DevPilot 與 SayDo 對齊：同一種文件角色，在兩個 repo 使用同一套資料夾與檔名規則。

## 2. Source File 命名

| 類型 | 規則 | 範例 |
| --- | --- | --- |
| React component | PascalCase | `TaskDispatchModal.tsx` |
| TypeScript utility | camelCase | `promptBuilder.ts` |
| Hook | camelCase + `use` 前綴 | `useAgentStatus.ts` |
| Rust module | snake_case | `process_manager.rs` |
| Shell script | kebab-case 或 snake_case，保留副檔名 | `docs-governance-check.sh` |
| Config | kebab-case 或生態系慣例 | `next.config.mjs` |

## 3. 文件命名

| 文件類型 | 資料夾 | 檔名規則 | 範例 |
| --- | --- | --- | --- |
| 產品策略、PRD、比較報告、feature plan | `docs/product/` | 英文 kebab-case | `competitive-analysis.md` |
| 工程規格或 runbook | `docs/engineering/` | 英文 kebab-case | `runtime-bridge.md` |
| UI/design guidance | `docs/design/` | 英文 kebab-case | `shared-ai-desktop-style.md` |
| Architecture decision | `docs/architecture/` | `ADR-###-kebab-case.md` | `ADR-006-schema-v2-sync-fields.md` |
| 專案進度或 handoff report | `docs/project-process/` | `YYYY-MM-DD-kebab-case.md` | `2026-05-15-technical-documentation-update.md` |
| 過時文件 | `docs/archive/` | `archived-YYYYMMDD-kebab-case.md` | `archived-20260512-adr-tauri.md` |

## 4. 資料夾慣例

DevPilot 與 SayDo 使用相同資料夾語意：

```text
docs/
├── architecture/       # ADR index and ADR-### records
├── archive/            # Deprecated docs only
├── design/             # UI/design system and design briefs
├── engineering/        # Engineering specs, command contracts, runbooks
├── product/            # Product strategy, PRDs, feature plans, comparisons
└── project-process/    # Progress reports, handoffs, daily/weekly logs
```

產品、工程、設計或 architecture overview 文件不應放在 repo root 或 `docs/` root。`docs/*.md` 根層只保留全 repo governance 文件，例如本文件。

## 5. 文件版型

全 repo governance 文件應使用雙語分層：

```markdown
# 標題

> metadata ...

## English Version

### 1. ...

## 中文版本

### 1. ...
```

子資料夾內的實作 contract 可使用英文-only，但檔名仍要是英文。

## 6. 歸檔規則

有歷史或決策價值的文件應歸檔，不直接刪除。

流程：

1. 將舊文件移到 `docs/archive/`。
2. 改名為 `archived-YYYYMMDD-kebab-case.md`。
3. 在檔案開頭加簡短說明，指出為何歸檔與替代文件。
4. 更新所有索引與 incoming links。
5. 若該文件被新的 architecture decision 取代，連到對應 ADR。

只有 generated output、空 placeholder、誤建重複檔、或沒有專案價值的檔案才直接刪除。

## 7. 根目錄規則

允許的根目錄 Markdown：

| 檔案 | 用途 |
| --- | --- |
| `README.md` | 專案入口 |
| `AGENTS.md` | AI engineer instructions |
| `CLAUDE.md` | Claude/Codex engineer hints |
| `DESIGN.md` | UI implementation guide |

避免新增根目錄文件。新內容應放到 role-based `docs/` 資料夾。

## 8. 品質檢查

Docs change 合併前執行：

```bash
npm run docs:check
npm run standards:check
```

DevPilot docs checker 會檢查：

- 檔名安全性
- repo-local docs layout 與適用文件的雙語區塊順序
- English block 是否在 Chinese block 前
- 是否有混合語言 heading pattern

## 9. 修改歷史

| 日期 | 版本 | 修改者 | 變更 |
| --- | --- | --- | --- |
| 2026-05-15 | 1.5 | Codex | 對齊 DevPilot 與 SayDo 的資料夾角色、歸檔規則與產品文件位置 |
| 2026-05-15 | 1.4 | Codex | 新增 engineering、design、project-process 目錄慣例 |
| 2026-05-12 | 1.3 | GitHub Copilot | 新增 fix 腳本流程 |
| 2026-05-12 | 1.2 | GitHub Copilot | 改為雙語分層版型 |
| 2026-05-12 | 1.1 | GitHub Copilot | 新增雙語版型規範 |
| 2026-05-12 | 1.0 | GitHub Copilot | 初版 |
