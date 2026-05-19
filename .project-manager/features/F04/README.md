# F04 — Add Project by GitHub URL

**Status**: on_hold | **Progress**: 10%  
**Category**: Core/Integration

## Summary

Allow users to add a project to the dashboard by pasting a GitHub repository URL. Project Manager clones or references the repo and creates a `.project-manager.json` scaffold from the repository structure.

## Notes

需要 GitHub token 設定與 Rust bridge 整合。GitHub token 應透過 OS Keychain 儲存（ADR-004），不得存放於 renderer 端。

## Design Decisions

- GitHub token stored in OS Keychain via `keyring` crate (consistent with Anthropic API key — ADR-004)
- Repository cloning runs in Rust to avoid blocking the UI thread
- Ingestion pipeline (F05) handles spec extraction after clone

## Blocked By

- GitHub OAuth flow not yet designed
- Ingestion pipeline (F05) still at 0%

## Related Files

- `docs/01-user-scenarios.md` — user scenario spec
- `lib/bridge/index.ts` — bridge entry point
- `src-tauri/src/lib.rs` — Rust commands
- `.project-manager/features/F05/README.md` — Spec Ingestion Pipeline
