# F03 — Live Run Inspector

**Status**: done | **Progress**: 100%  
**Category**: Frontend/Monitor  
**Implementation**: `app/ui/views/RunsView.tsx`

## Summary

Real-time view of active agent/IDE dispatch runs. Shows run status, output stream, duration, and assigned engineer role.

## Completed Work

- Agent workflow coverage is tracked through `__tests__/agentWorkflows.test.ts`.
- Dispatch UI now records active process state, output, PID, and exit events.
- Follow-up durable run history is tracked separately in engineering docs before sync work.

## Bridge Requirements

- `list_active_runs` — snapshot of currently running processes
- Tauri event `run:output:<runId>` — streamed stdout lines
- `kill_run` — terminate a specific run by ID

## Related Files

- `lib/bridge/index.ts` — bridge wrappers
- `src-tauri/src/lib.rs` — Rust command implementations
- `app/sessions/` — session history view
