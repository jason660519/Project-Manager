# F42 - Chat Runtime Security Boundary Migration

## Summary

Move AI Assistant chat provider execution behind secure runtime boundaries so the renderer never reads or forwards raw provider keys, and so shipped Tauri/static-export chat does not depend on Next.js `app/api/chat/*` routes.

This feature covers the agreed P0 line first:

- Remove renderer-side provider key reads from chat message sends.
- Add a runtime-safe chat dispatch path that selects Browser/server route only in browser dev mode and Tauri/Rust bridge in desktop mode.
- Make provider/model response metadata observable without leaking secrets.

Follow-up P1 items are tracked here because they share the same execution boundary:

- Abort should kill any spawned local agent CLI process.
- Tool results should preserve enough context for accurate final model answers and audit review.
- Floating panel sessions should persist like the full AI Assistants page.

## Current State

- Status: in_progress
- Progress: 10%
- Phase: development
- Category: Security/Runtime
- Owner: Codex
- Created: 2026-06-01

## Scope

- AI Assistant chat request routing:
  - `lib/chat/chatAgent.ts`
  - `components/chat/*`
  - `app/chat/ChatPageClient.tsx`
  - `app/api/chat/*` for browser-only fallback behavior
  - `lib/bridge/index.ts` and `src-tauri/src/lib.rs` for Tauri provider execution
- Secret boundary alignment with ADR-004:
  - renderer may hold provider/model preference only
  - Rust/server runtime owns raw provider key lookup and HTTP headers
- Tests for user scenarios, regression risks, and static-export/Tauri boundary behavior.

## Non-Goals

- Rebuilding the whole Keys page.
- Changing `.project-manager/config.json` schemaVersion.
- Storing real API keys, prompt transcripts, or private conversation data in feature artifacts.
- Implementing all P2 iteration features in this first slice.

## Artifacts

- Feature spec: `feature-spec.md`
- TDD spec: `tdd-spec.md`
- User scenarios: `test-scenarios.md`
- Dev log: `dev-log.md`

## Key Decisions

- Treat P0 security and Tauri runtime migration as one workstream: splitting them would leave either key exposure or broken desktop chat.
- Browser dev mode may keep API routes, but they must read secrets server-side instead of accepting raw keys from the renderer.
- Tauri mode must call bridge/Rust commands for provider execution and raw secret lookup.
