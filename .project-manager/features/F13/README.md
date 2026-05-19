# F13 — Dispatch UX Improvements & Bug Fixes

**Status**: in_progress | **Progress**: 0%
**Category**: Frontend/Dispatch
**Owner**: PM Team

## Summary

Improve the Task Dispatch and Batch Dispatch modals with missing UX states,
error handling, and status feedback. Address known issues from the Execution
Target Dispatch update (2026-05-19) and add missing loading/error states across
the dispatch workflow.

## Implementation Files

| File | Role |
|---|---|
| `components/table/TaskDispatchModal.tsx` | Single-feature dispatch modal |
| `components/table/BatchDispatchModal.tsx` | Multi-feature batch dispatch modal |
| `lib/adapters/` | Adapter runtime layer |
| `lib/i18n/en.ts` | English strings |
| `lib/i18n/zh-hant.ts` | Traditional Chinese strings |
| `lib/i18n/zh.ts` | Simplified Chinese strings |
| `lib/i18n/ja.ts` | Japanese strings |

## Remaining Work

- Loading/error/empty states for dispatch preview and execution
- Kill confirmation before terminating an active dispatch
- Graceful adapter not-found / config mismatch handling
- Visual feedback when adapter command is not installed
- MCP server list refresh validation
