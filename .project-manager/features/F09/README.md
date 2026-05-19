# F09 — Zone 3: ViewHeader (Removed)

**Status**: done | **Progress**: 100%  
**Category**: Frontend/UI

## Summary

Originally planned as a unified content sub-header per view (active project name, stats strip, primary CTA). Modelled on Hermes "CONNECTED PLATFORMS" section header.

## Decision: Removed

After implementation, the ViewHeader was found to be redundant — the TopBar (F08) already provides sufficient view-level context. The component was deleted rather than kept as dead code.

**Files removed**:
- `app/ui/ViewHeader.tsx` (deleted)
- `viewHeader` prop from `AppShell.tsx` (removed)
- `ViewHeader` import from `MainClient.tsx` (removed)

## Lesson

Test zone components against real content before wiring into AppShell. The sub-header pattern works in Hermes because it carries live gateway metrics; PM does not have an equivalent always-visible entity at the view level.
