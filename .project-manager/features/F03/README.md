# F03 — Live Run Inspector

**Status**: in_progress | **Progress**: 30%  
**Category**: Frontend/Monitor  
**Implementation**: `app/ui/views/RunsView.tsx`

## Summary

Real-time view of active agent/IDE dispatch runs. Shows run status, output stream, duration, and assigned engineer role.

## Remaining Work

- Stream stdout/stderr from Rust bridge via Tauri event channel
- Kill / pause individual run controls
- Persist run history to `sessions` store
- Filter by project / engineer role

## Bridge Requirements

- `list_active_runs` — snapshot of currently running processes
- Tauri event `run:output:<runId>` — streamed stdout lines
- `kill_run` — terminate a specific run by ID

## Related Files

- `lib/bridge/index.ts` — bridge wrappers
- `src-tauri/src/lib.rs` — Rust command implementations
- `app/sessions/` — session history view
