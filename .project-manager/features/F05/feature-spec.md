# F05 Feature Spec - Spec Ingestion Pipeline

## Purpose

Convert loose source material into reviewed Project Manager feature drafts. The pipeline accepts practical project inputs, extracts or infers feature candidates, shows the user what was found, and only writes canonical project data after review.

## Source References

- `docs/product/project-manager-prd.md` - P1 requirement for AI spec import from `.docx`, `.xlsx`, and `.md`.
- `docs/engineering/ingestion-pipeline.md` - current ingestion contract, known gaps, and non-negotiables.
- `app/ui/views/IngestionView.tsx` - review UI and import entry point.
- `lib/ingestion/parseMarkdown.ts` - Markdown parser path.
- `lib/bridge/index.ts` and `src-tauri/src/lib.rs` - AI-assisted parsing and secure bridge boundary.

## Functional Requirements

1. Parse Markdown into feature drafts using headings, checkbox tasks, category/status metadata, and body notes.
2. Route DOCX, XLSX, PDF, and unknown files through an inspectable AI-assisted draft path when local parsing is not available.
3. Display parse method, confidence, and failure reason before save.
4. Preserve user edits made in the review step.
5. Generate stable feature IDs and canonical feature artifact paths when drafts are saved.
6. Run saved config through `migrateConfig()` before persistence.

## Non-Negotiables

1. Do not invent canonical project data without user review.
2. Do not silently replace high-confidence extraction with mock output.
3. Do not hide parser failures behind apparently valid feature rows.
4. Keep API keys and AI calls in backend/runtime code paths.

## Dashboard Contract

This is the canonical `paths.spec` file for F05. The feature overview remains `.project-manager/features/F05/README.md`, and `notes` remains short text only.

## Acceptance Checks

- Markdown import produces editable draft rows.
- Binary or unsupported files clearly identify the parser path and confidence.
- Failed extraction blocks save or presents an explicit review-only state.
- Saved drafts use canonical `.project-manager/features/<id>/` artifact paths.
- Dashboard links for this feature resolve to files that exist.
