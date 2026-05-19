# F05 — Spec Ingestion Pipeline

**Status**: todo | **Progress**: 0%  
**Category**: Core/AI  
**Spec**: `docs/02-prd.md`

## Summary

AI-powered pipeline that ingests heterogeneous source formats (Word, Excel, Markdown, folder structures) and maps them to the canonical `.project-manager.json` schema.

## Design

```
Source (Word / Excel / MD / Folder)
  → Format Parser (lib/ingestion/)
  → AI Field Mapper (Rust call_anthropic)
  → Canonical Feature JSON (schemaVersion: 1)
  → Merge into .project-manager/config.json
```

## Key Constraints

- AI field mapping runs in Rust via `call_anthropic` (ADR-004 — API key never in renderer)
- Prompt assembly stays in TypeScript (ADR-003 — `argsTemplate` substitution is a TS concern)
- Schema changes require `schemaVersion` bump (ADR-002)

## Related Files

- `lib/ingestion/` — format parsers
- `src-tauri/src/lib.rs` — `call_anthropic` Rust command
- `schema/project-manager.schema.json` — canonical schema
- `docs/02-prd.md` — product requirements
