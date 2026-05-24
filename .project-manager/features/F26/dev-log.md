# F26 Dev Log: PWE Dispatch Harness

## 2026-05-25 — Session 1: Research & Planning Artifacts

### What was done

1. **Codebase research** — Traced the full dispatch chain from table chip → modal → bridge:
   - `columns.tsx:343-423` — `actionsCol()` renders P/W/E chips and Dispatch button.
   - `TaskDispatchModal.tsx` (~1550 lines) — current single-role dispatch modal.
   - `MainClient.tsx:614-660` — `activeRuns[]` state + `handleRunStart/Log/End` callbacks.
   - `lib/types/index.ts` — `FeatureHarnessAssignment`, `HarnessTaskRole`, `ActiveRun`, `CompletedRun`.
   - `lib/bridge/index.ts` — `spawnAgent`, `killProcess`, `onAgentStdout`, `onAgentExit`.

2. **Type analysis** — Documented existing shapes:
   - `FeatureHarnessAssignment`: `{ engineerRoleId, assignedIDE, assignedTo, assignedAt, adapterId, lastDispatchModel }` — no running-state fields yet.
   - `FeatureHarnessAssignments`: `{ planner?, worker?, evaluator? }` — already has the three-role slots.
   - `ActiveRun`: `{ pid, featureId, featureName, command, args, startedAt, logs, phase }` — managed in `MainClient` state array.
   - `HarnessTaskRole`: `'planner' | 'worker' | 'evaluator'` — already defined.

3. **Created F26 feature folder** at `.project-manager/features/F26/` with README.md.

4. **Added F26 to config.json** — ID: F26, category: Dispatch, 8 SP, status: in_progress.

5. **Wrote feature-spec.md** — 10 functional requirements (FR-1 through FR-10) covering:
   - Three-sheet BottomSheetTabs layout
   - RoleConfigPanel extraction
   - Per-role independent state management
   - Dispatch All (batch) and per-role dispatch
   - Unified log panel with role-tag prefixes
   - Running-state P/W/E chips with animated indicators
   - Type extensions (activePid, status)
   - Kill support, state cleanup on modal close

6. **Wrote tdd-spec.md** — 10 test groups (T-1 through T-10) with 60+ test cases covering:
   - RoleConfigPanel rendering (10 cases)
   - Sheet layout (6 cases)
   - Per-role state independence (5 cases)
   - Dispatch All batch (7 cases)
   - Per-role dispatch (6 cases)
   - Unified log panel (8 cases)
   - Running-state chips (8 cases)
   - Kill support (6 cases)
   - Modal lifecycle (5 cases)
   - Edge cases (8 cases)

### Architecture decisions

| Decision | Rationale |
|---|---|
| Sheets inside modal, not full WorkstationFrame | Modal is an overlay; BottomSheetTabs gives sheet UX without requiring viewport-fixed frame |
| Unified log panel (not per-tab) | Three concurrent agents produce interleaved output; merged view shows full timeline with role-tag colors |
| `activePid` + `status` on `FeatureHarnessAssignment` | Co-locates running state with assignment data; parent `activeRuns[]` is the source of truth for chip rendering |
| RoleConfigPanel as extracted component | TaskDispatchModal is already ~1550 lines; three inline copies would be unmaintainable |
| No orchestration (P→W→E pipeline) | User explicitly requested concurrent/independent dispatch; orchestration is a future feature |

### What was not done

- No code implementation yet — this session focused on specs and planning.
- No test scaffolding written yet.
- No type changes made yet.

### Risks and considerations

1. **TaskDispatchModal complexity**: The modal will grow significantly even with RoleConfigPanel extraction. Three independent state bundles, three sets of event listeners, batch dispatch logic. Careful state management is critical.
2. **Event listener cleanup**: Three concurrent `onAgentStdout`/`onAgentExit` listeners must be scoped to their respective PIDs and cleaned up on unmount. Current code already handles single-PID cleanup; extending to three needs care.
3. **activeRuns threading**: Running-state chips in `columns.tsx` need access to `activeRuns[]` from `MainClient`. This data currently doesn't flow to the column renderer — it needs to be threaded through `ProjectProgressClient` → `PhaseTabContent` → column handlers.
4. **Log panel performance**: Three concurrent agents can produce high log volume. Consider a log line cap (e.g., keep last 500 lines) to prevent DOM explosion.

### Verification baseline

```bash
npm run typecheck   # passes (no changes yet)
npm run build       # passes (no changes yet)
```

### Next steps (priority order)

1. Extend `FeatureHarnessAssignment` type with `activePid` and `status` fields.
2. Create `components/table/RoleConfigPanel.tsx` — extract from current TaskDispatchModal.
3. Rewrite `TaskDispatchModal.tsx` with three-sheet layout and batch dispatch.
4. Update `columns.tsx` `actionsCol()` chips with running-state indicators.
5. Thread `activeRuns` from `MainClient` → columns for chip state.
6. Write unit/integration tests per TDD spec.
7. Manual verification: open dispatch modal, configure 3 roles, dispatch all, verify chips update.

### Files changed

| File | Change |
|---|---|
| `.project-manager/config.json` | Added F26 entry |
| `.project-manager/features/F26/README.md` | Created |
| `.project-manager/features/F26/feature-spec.md` | Created |
| `.project-manager/features/F26/tdd-spec.md` | Created |
| `.project-manager/features/F26/dev-log.md` | Created (this file) |
