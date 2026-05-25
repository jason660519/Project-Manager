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

---

## 2026-05-25 — Session 2: Core Implementation

### What was done

1. **Type extension** (`lib/types/index.ts`):
   - Added `HarnessRoleStatus = 'idle' | 'running' | 'done' | 'error'` type.
   - Extended `FeatureHarnessAssignment` with `activePid?: number` and `status?: HarnessRoleStatus`.

2. **Created `RoleConfigPanel`** (`components/table/RoleConfigPanel.tsx`, ~380 lines):
   - Extracted per-role configuration form from TaskDispatchModal.
   - Contains: engineer role selector, adapter/target selector (grouped by IDE/CLI/App), model preview, prompt template picker + textarea, workflow selector, advanced auto-loop options, MCP injection preview, scope warning.
   - Exports `RoleConfigState` interface and `initialRoleConfigState()` helper for state initialization from `feature.harnessAssignments[role]`.
   - Re-exports shared helpers (`adapterToIDE`, `resolvePath`, `IDE_IDS`) for TaskDispatchModal dispatch logic.

3. **Rewrote `TaskDispatchModal`** (`components/table/TaskDispatchModal.tsx`, ~370 lines — down from ~1550):
   - **Three-sheet layout**: Uses `BottomSheetTabs` with P/W/E tabs at the bottom of the config area.
   - **Three independent `RoleConfigState` bundles**: `plannerConfig`, `workerConfig`, `evaluatorConfig` — each with its own engineer, adapter, prompt, workflow, auto-loop settings.
   - **Batch dispatch**: "Dispatch All" button dispatches all configured roles concurrently via `Promise.allSettled`. Skips roles with no adapter selected, shows skip count.
   - **Per-role dispatch**: "Dispatch P/W/E" button dispatches only the active tab's role.
   - **Unified log panel**: Merged `LogEntry[]` with role tags `[P]`, `[W]`, `[E]` in distinct colors (stone/cyan/amber). Process exit events shown as separator lines.
   - **Per-role run state**: `RoleRunState { phase, activePid }` tracked per role. Tab badges show `●`(pending spin), `●`(running pulse), `✓`(done), `✗`(error).
   - **Kill support**: Per-role kill from footer with confirmation dialog.
   - **Open in Terminal**: Available for agent-cli adapters on the active tab.
   - **Harness assignment persistence**: On dispatch, updates `feature.harnessAssignments[role]` with `activePid` and `status`. On exit, clears `activePid` and sets `status` to `done`/`error`.

4. **Updated P/W/E chips** (`app/project-progress-dashboard/_lib/columns.tsx`):
   - Created `PWEChip` component with four visual states:
     - **Idle**: current grey/cyan/amber styling, letter + name.
     - **Running**: emerald border/bg, pulsing green dot + name.
     - **Done**: emerald check mark + name.
     - **Error**: red cross + name.
   - `resolveRoleStatus()` checks `feature.harnessAssignments[role].activePid` against `activeRuns[]` for real-time running detection.
   - Added `activeRuns?: ActiveRun[]` to `ColumnHandlers` interface.

5. **Threaded `activeRuns` through the data flow**:
   - `PhaseTabContent` accepts new `activeRuns` prop.
   - `ProjectProgressClient` passes `activeRuns` to `PhaseTabContent`.
   - `PhaseTabContent` forwards to `handlers` object used by column renderers.

### Verification

```bash
npm run typecheck   # ✅ 0 errors
npm run build       # ✅ Static export successful
```

### Architecture notes

- **TaskDispatchModal went from ~1550 → ~370 lines** by extracting RoleConfigPanel. The modal now focuses on orchestration (state management, dispatch logic, log merging, sheet tabs) while the panel handles per-role UI.
- **Running state lives in two places**: `FeatureHarnessAssignment.activePid/status` (persisted in config, used by chips) and `MainClient.activeRuns[]` (ephemeral, used for ops panel). The chip renderer cross-references both to handle the case where `activePid` is stale (process died without cleanup).
- **Log entries are typed** as `LogEntry { role, line }` — this makes role-based filtering straightforward if a per-role log view is desired later.

### Files changed

| File | Change |
|---|---|
| `lib/types/index.ts` | Added `HarnessRoleStatus`, extended `FeatureHarnessAssignment` |
| `components/table/RoleConfigPanel.tsx` | **NEW** — extracted per-role config form |
| `components/table/TaskDispatchModal.tsx` | **REWRITE** — three-sheet layout, batch dispatch, unified log |
| `app/project-progress-dashboard/_lib/columns.tsx` | PWEChip component, running-state indicators, `activeRuns` in handlers |
| `app/project-progress-dashboard/_components/PhaseTabContent.tsx` | Accept + forward `activeRuns` prop |
| `app/project-progress-dashboard/ProjectProgressClient.tsx` | Pass `activeRuns` to PhaseTabContent |

### What remains

- [ ] Write unit/integration tests per TDD spec (T-1 through T-10).
- [ ] Manual UI verification: open dispatch modal, switch tabs, dispatch individual + batch, verify chip state changes.
- [ ] Consider log line cap (~500 lines) for long-running concurrent agents.
- [ ] Consider adding a "Dispatch All" count badge to show how many roles will fire.
