# Ingestion Pipeline

> Status: Active  
> Last updated: 2026-05-15  
> Primary files: `app/ui/views/IngestionView.tsx`, `lib/ingestion/parseMarkdown.ts`, `lib/bridge/index.ts`

---

## English Version

## 1. Goal

The ingestion pipeline converts loose source material into reviewed `Feature` drafts before writing to `.project-manager.json`. User review is required before imported drafts become canonical project data.

## 2. Current Paths

| Input | Current Path | Runtime | Confidence |
| --- | --- | --- | --- |
| Markdown | `parseMarkdown(text, fileName)` | Browser and Tauri | High |
| DOCX, XLSX, PDF, or unknown file | AI-assisted draft generation | Tauri preferred | Medium |
| Browser dev mode for binary files | Filename-derived mock draft | Browser only | Low, review-only |

The mock path exists only to keep the review UI reachable during development. It must be visibly labeled as simulated and must not be presented as validated extraction.

## 3. Markdown Parser Contract

`parseMarkdown` supports:

1. `## Heading` as one feature section.
2. `**Category:** value` inside a section.
3. `**Status:** value` inside a section.
4. `- [ ] Task name` outside sections as standalone todo features.
5. Body text as feature notes.

Fallback behavior: if no markers are found, create one feature from the filename with `Imported` category and `todo` status.

## 4. Review Before Save

Imported drafts should be editable before save. The save path should:

1. Preserve user edits.
2. Generate stable feature paths from slugs when possible.
3. Avoid overwriting existing features unless the user explicitly confirms merge or replace.
4. Run project config through `migrateConfig()` before persistence.

## 5. Known Gaps

| Gap | Impact | Needed Next |
| --- | --- | --- |
| Real DOCX parser contract | Word import quality cannot be guaranteed. | Define parser output schema and failure categories. |
| Real XLSX parser contract | Spreadsheet column mapping is still underspecified. | Define column matching and confidence scoring. |
| AI fallback evidence | AI-generated drafts need traceability to source spans or cells. | Store extraction evidence per draft. |
| Failure reporting | Fallback can hide extraction quality. | Show parse method, confidence, and blocking errors in UI. |

## 6. Non-Negotiables

1. Do not invent canonical project data without review.
2. Do not silently replace high-confidence extraction with mock output.
3. Surface the parser used, confidence level, and failure reason.
4. Keep `.project-manager.json` as the canonical save target.

---

## 中文版本

## 1. 目標

Ingestion pipeline 將鬆散來源資料轉成待審核的 `Feature` drafts，再寫入 `.project-manager.json`。Imported drafts 成為正式 project data 前必須經過使用者 review。

## 2. 目前路徑

| Input | Current Path | Runtime | Confidence |
| --- | --- | --- | --- |
| Markdown | `parseMarkdown(text, fileName)` | Browser 與 Tauri | High |
| DOCX、XLSX、PDF 或 unknown file | AI-assisted draft generation | 優先 Tauri | Medium |
| Browser dev mode 的 binary files | Filename-derived mock draft | Browser only | Low，僅供 review UI |

Mock path 只用來讓開發時 review UI 可操作。它必須明確標示為 simulated，不能被呈現成已驗證 extraction。

## 3. Markdown Parser Contract

`parseMarkdown` 支援：

1. `## Heading` 產生一個 feature section。
2. Section 內的 `**Category:** value`。
3. Section 內的 `**Status:** value`。
4. Section 外的 `- [ ] Task name` 產生 standalone todo features。
5. Body text 進入 feature notes。

Fallback behavior：如果沒有找到 marker，從 filename 建立單一 feature，category 為 `Imported`，status 為 `todo`。

## 4. Review Before Save

Imported drafts 在 save 前應可編輯。Save path 應該：

1. 保留使用者 edits。
2. 盡可能從 slug 產生穩定 feature paths。
3. 除非使用者明確確認 merge 或 replace，否則不要覆蓋既有 features。
4. Persistence 前先對 project config 跑 `migrateConfig()`。

## 5. Known Gaps

| 缺口 | 影響 | 下一步 |
| --- | --- | --- |
| Real DOCX parser contract | Word import quality 無法保證。 | 定義 parser output schema 與 failure categories。 |
| Real XLSX parser contract | Spreadsheet column mapping 仍不足。 | 定義 column matching 與 confidence scoring。 |
| AI fallback evidence | AI-generated drafts 需要可追溯到 source spans 或 cells。 | 每個 draft 保存 extraction evidence。 |
| Failure reporting | Fallback 可能掩蓋 extraction quality。 | UI 顯示 parse method、confidence 與 blocking errors。 |

## 6. Non-Negotiables

1. 不經 review，不產生 canonical project data。
2. 不可靜默用 mock output 取代 high-confidence extraction。
3. 必須顯示 parser、confidence level、failure reason。
4. `.project-manager.json` 是 canonical save target。
