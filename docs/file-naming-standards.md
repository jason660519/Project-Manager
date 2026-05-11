# DevPilot File Naming and Archiving Standards

> **Created Date**: 2026-05-12
> **Created By**: GitHub Copilot
> **Last Modified**: 2026-05-12
> **Modified By**: GitHub Copilot
> **Version**: 1.3
> **Document Type**: Technical Documentation

---

## English Version

## 1. Core Principles

1. Use English-only filenames and directory names.
2. Keep naming predictable by file type.
3. Preserve history by archiving deprecated docs instead of deleting.
4. Use bilingual block layout for technical docs:
   - English block first (`## English Version`)
   - Chinese block second (`## 中文版本`)
5. Never mix Chinese and English in the same heading, bullet, or table row.

## 2. Naming Rules

### 2.1 Source Files

| Type | Rule | Example |
| --- | --- | --- |
| React component | PascalCase | `TaskDispatchModal.tsx` |
| TS utility | camelCase | `promptBuilder.ts` |
| Hook | camelCase with `use` | `useAgentStatus.ts` |
| Rust module | snake_case | `process_manager.rs` |
| Config | kebab-case or conventional | `next.config.mjs` |

### 2.2 Documentation Files

| Type | Rule | Example |
| --- | --- | --- |
| Product docs | numeric prefix | `01-user-scenarios.md` |
| ADR docs | `ADR-###-kebab-case.md` | `ADR-001-tauri-selection.md` |
| Reports | date prefix | `20260512-weekly-report.md` |
| Archived docs | `archived-YYYYMMDD-name.md` | `archived-20260512-05-adr-tauri.md` |

## 3. Documentation Layout Standard

All technical docs under `docs/` should use this structure:

```markdown
# Title

> metadata ...

## English Version

### 1. ...

## 中文版本

### 1. ...
```

## 4. Archiving Policy

1. Do not delete deprecated technical docs.
2. Move deprecated files to `docs/archive/`.
3. Rename with `archived-YYYYMMDD-` prefix.
4. Add a short deprecation note at top of archived file.

## 5. Folder Conventions for This Repo

```text
docs/
├── 01-user-scenarios.md
├── 02-prd.md
├── 03-target-audience.md
├── 04-competitive-analysis.md
├── Architecture.md
├── file-naming-standards.md
├── architecture/
│   ├── README.md
│   └── ADR-###-*.md
└── archive/
```

## 6. Quality Gate

Run this before merging docs changes:

```bash
./scripts/docs-governance-check.sh
```

If check fails, run auto-fix for common issues:

```bash
./scripts/docs-governance-fix.sh
```

Archive one deprecated file via fix script:

```bash
./scripts/docs-governance-fix.sh . archive docs/some-file.md
```

The checker validates:

- filename safety
- bilingual section existence
- section order (English above Chinese)
- mixed-language heading pattern

## 7. Change History

| Date | Version | Modified By | Changes |
| --- | --- | --- | --- |
| 2026-05-12 | 1.3 | GitHub Copilot | Added governance fix script workflow |
| 2026-05-12 | 1.2 | GitHub Copilot | Refactored into separated bilingual blocks |
| 2026-05-12 | 1.1 | GitHub Copilot | Added bilingual layout policy |
| 2026-05-12 | 1.0 | GitHub Copilot | Initial version |

---

## 中文版本

## 1. 核心原則

1. 所有檔案與資料夾名稱都使用英文。
2. 不同類型檔案使用固定命名規則。
3. 過時文件用歸檔，不直接刪除。
4. 技術文件採雙語分層：
   - 英文區塊在上（`## English Version`）
   - 中文區塊在下（`## 中文版本`）
5. 同一個標題、條列或表格列不得混用中英文。

## 2. 命名規範

### 2.1 程式碼檔案

| 類型 | 規則 | 範例 |
| --- | --- | --- |
| React 元件 | PascalCase | `TaskDispatchModal.tsx` |
| TS 工具檔 | camelCase | `promptBuilder.ts` |
| Hook | camelCase + `use` 前綴 | `useAgentStatus.ts` |
| Rust 模組 | snake_case | `process_manager.rs` |
| 設定檔 | kebab-case 或慣例名稱 | `next.config.mjs` |

### 2.2 文件檔案

| 類型 | 規則 | 範例 |
| --- | --- | --- |
| 產品文件 | 數字前綴 | `01-user-scenarios.md` |
| ADR 文件 | `ADR-###-kebab-case.md` | `ADR-001-tauri-selection.md` |
| 報告文件 | 日期前綴 | `20260512-weekly-report.md` |
| 歸檔文件 | `archived-YYYYMMDD-name.md` | `archived-20260512-05-adr-tauri.md` |

## 3. 文件版型標準

`docs/` 下技術文件一律使用以下結構：

```markdown
# 標題

> metadata ...

## English Version

### 1. ...

## 中文版本

### 1. ...
```

## 4. 歸檔規則

1. 過時技術文件不可直接刪除。
2. 一律移到 `docs/archive/`。
3. 檔名前加 `archived-YYYYMMDD-`。
4. 檔案開頭加上簡短停用說明。

## 5. 本專案目錄慣例

```text
docs/
├── 01-user-scenarios.md
├── 02-prd.md
├── 03-target-audience.md
├── 04-competitive-analysis.md
├── Architecture.md
├── file-naming-standards.md
├── architecture/
│   ├── README.md
│   └── ADR-###-*.md
└── archive/
```

## 6. 合併前檢查

請在提交前執行：

```bash
./scripts/docs-governance-check.sh
```

若檢查未通過，可先執行自動修正常見問題：

```bash
./scripts/docs-governance-fix.sh
```

若要一併歸檔單一過時文件：

```bash
./scripts/docs-governance-fix.sh . archive docs/some-file.md
```

檢查項目包含：

- 檔名安全性
- 雙語章節是否存在
- 英文章節是否在中文章節之前
- 是否有混合語言標題

## 7. 修改歷史

| 日期 | 版本 | 修改者 | 變更 |
| --- | --- | --- | --- |
| 2026-05-12 | 1.3 | GitHub Copilot | 新增 fix 腳本流程 |
| 2026-05-12 | 1.2 | GitHub Copilot | 改為雙語分層版型 |
| 2026-05-12 | 1.1 | GitHub Copilot | 新增雙語版型規範 |
| 2026-05-12 | 1.0 | GitHub Copilot | 初版 |
