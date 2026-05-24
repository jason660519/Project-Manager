# F26 TDD Spec: PWE Dispatch Harness — Three-Role Sheet Dispatch

## Test Strategy

This feature touches UI components (modal, chips, tabs), state management (per-role dispatch state), and bridge integration (spawnAgent, event listeners). Tests are divided into:

- **Unit tests**: Component rendering, state logic, type correctness.
- **Integration tests**: Multi-role dispatch flow, log merging, state propagation.
- **E2E tests**: Full user journey through the dispatch modal.

Test framework: Jest + React Testing Library (unit/integration), Playwright (E2E).

---

## Test Matrix

### T-1: RoleConfigPanel Rendering

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-1.1 | Renders engineer role dropdown with all roles | Unit | Dropdown shows all `engineerRoles[]` + "No role" option |
| T-1.2 | Renders adapter groups (IDE / CLI / App) | Unit | Grouped `<optgroup>` or sections for each adapter type |
| T-1.3 | Shows model preview when engineer has primaryModel | Unit | Read-only model info visible |
| T-1.4 | Shows "No primary model" warning when engineer lacks model | Unit | Amber warning text visible |
| T-1.5 | Shows prompt template buttons for agent-cli adapter | Unit | Template buttons rendered, textarea visible |
| T-1.6 | Hides prompt template for IDE adapter | Unit | No template buttons, shows target file path instead |
| T-1.7 | Shows workflow selector for agent-cli adapter | Unit | Workflow dropdown visible |
| T-1.8 | Shows advanced options (auto-loop) for agent-cli | Unit | Collapsible advanced section present |
| T-1.9 | Shows MCP injection preview for agent-cli | Unit | MCP badge or message visible |
| T-1.10 | Shows scope warning for strict-mode engineer outside scope | Unit | Orange scope warning visible |

### T-2: TaskDispatchModal — Sheet Layout

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-2.1 | Renders three BottomSheetTabs: P, W, E | Unit | Three tab buttons visible with correct labels |
| T-2.2 | Default active tab is W (Worker) | Unit | W tab active on mount |
| T-2.3 | Clicking tab switches visible RoleConfigPanel | Unit | Config panel updates to selected role's state |
| T-2.4 | Tab badges show idle indicator for unconfigured roles | Unit | `●` icon on each tab |
| T-2.5 | Shared phase selector applies to all roles | Unit | Changing phase updates `selectedPhase` for all |
| T-2.6 | Pre-fills from feature.harnessAssignments on mount | Integration | Each sheet loads saved engineer/adapter/prompt |

### T-3: Per-Role State Independence

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-3.1 | Changing engineer on P sheet does not affect W or E | Unit | W and E retain their selections |
| T-3.2 | Changing adapter on W sheet does not affect P or E | Unit | P and E retain their selections |
| T-3.3 | Editing prompt on E sheet does not affect P or W | Unit | P and W prompts unchanged |
| T-3.4 | Applying prompt template on one sheet only affects that sheet | Unit | Other sheets' prompts unchanged |
| T-3.5 | Three independent RoleState objects maintained | Unit | State hook returns separate objects per role |

### T-4: Dispatch All (Batch)

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-4.1 | Dispatch All with all three roles configured | Integration | Three `spawnAgent` calls made concurrently |
| T-4.2 | Dispatch All with only P and E configured (W empty) | Integration | Two `spawnAgent` calls; W skipped; skip note shown |
| T-4.3 | Dispatch All with no roles configured | Integration | Button disabled or no-op; error message shown |
| T-4.4 | Dispatch All calls onFeatureUpdate for each role | Integration | `onFeatureUpdate` called 3 times (or 2 if one skipped) |
| T-4.5 | Dispatch All sets each role phase to 'running' | Integration | All dispatched roles show running state |
| T-4.6 | Dispatch All skips already-running roles | Integration | Running role not double-dispatched |
| T-4.7 | Dispatch All records correct harnessAssignments patch | Integration | Each role's assignment includes engineerRoleId, adapterId, assignedTo, assignedAt |

### T-5: Per-Role Dispatch

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-5.1 | Dispatch P only from P sheet | Integration | Only P spawned; W, E remain idle |
| T-5.2 | Dispatch W with override warning (already assigned) | Integration | Warning shown; dispatch proceeds after confirmation |
| T-5.3 | Dispatch E with IDE adapter | Integration | Calls `handleOpenExternalTarget`; no managed PID |
| T-5.4 | Dispatch button disabled when adapter is missing/blocked | Unit | Button has `disabled` attribute |
| T-5.5 | Dispatch button disabled while role is pending | Unit | Button disabled during command building |
| T-5.6 | Dispatch sets role-specific assignment patch | Integration | Only the dispatched role's harnessAssignment updated |

### T-6: Unified Log Panel

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-6.1 | Empty state shows placeholder when no logs | Unit | "Dispatch one or more roles to see output here." |
| T-6.2 | Logs from P prefixed with `[P]` in stone color | Unit | Log line starts with colored `[P]` |
| T-6.3 | Logs from W prefixed with `[W]` in cyan color | Unit | Log line starts with colored `[W]` |
| T-6.4 | Logs from E prefixed with `[E]` in amber color | Unit | Log line starts with colored `[E]` |
| T-6.5 | Logs from multiple roles interleave chronologically | Integration | Lines appear in timestamp order, not grouped by role |
| T-6.6 | Process exit event shows separator line | Integration | `── P exited (PID 12345, code 0) ──` visible |
| T-6.7 | Log panel auto-scrolls to bottom on new entry | Unit | `scrollIntoView` called on log end ref |
| T-6.8 | Log panel handles 1000+ lines without freeze | Unit | Virtualized or truncated; no DOM explosion |

### T-7: P/W/E Running-State Chips (columns.tsx)

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-7.1 | Chip shows `—` when no engineer assigned | Unit | `P —` in stone styling |
| T-7.2 | Chip shows engineer name when assigned, not running | Unit | `P Jason` in current styling |
| T-7.3 | Chip shows `●` with animate-pulse when running | Unit | Green pulsing dot + name, emerald border |
| T-7.4 | Chip shows `✓` when last run succeeded | Unit | Emerald check + name |
| T-7.5 | Chip shows `✗` when last run failed | Unit | Red cross + name |
| T-7.6 | Running state derived from activeRuns + activePid | Integration | Chip checks `activeRuns.some(r => r.pid === activePid)` |
| T-7.7 | Chip returns to assigned state after process exit | Integration | Running indicator disappears; reverts to name-only |
| T-7.8 | Tooltip shows full role + engineer + status | Unit | `title` attr: "Planner: Jason (running)" |

### T-8: Kill Support

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-8.1 | Kill button visible for running role in footer | Unit | "Kill" button appears when active tab's role is running |
| T-8.2 | Kill confirmation dialog shows PID and role | Unit | Dialog mentions role name and PID |
| T-8.3 | Confirming kill calls `killProcess(pid)` | Integration | Bridge `killProcess` invoked |
| T-8.4 | After kill, role status changes to error | Integration | Role phase → 'error', activePid cleared |
| T-8.5 | Kill one role does not affect other running roles | Integration | Other roles continue running |
| T-8.6 | Kill confirmation cancel does not kill process | Unit | Cancel closes dialog, process continues |

### T-9: Modal Lifecycle

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-9.1 | Close modal while roles running — processes continue | Integration | `spawnAgent` processes not killed on unmount |
| T-9.2 | Event listeners cleaned up on modal unmount | Integration | `unlistenRefs` cleanup runs for all registered listeners |
| T-9.3 | Re-opening modal for same feature shows running state | Integration | Role phases reflect current `activeRuns` |
| T-9.4 | Re-opening modal does not replay old logs | Unit | Log state starts empty on fresh mount |
| T-9.5 | Modal unmount with no running processes is clean | Unit | No error logs, no leaked listeners |

### T-10: Edge Cases

| ID | Scenario | Level | Expected |
|---|---|---|---|
| T-10.1 | Feature with no adapters shows disabled state | Unit | "No available adapters" message on all sheets |
| T-10.2 | Engineer role deleted between dispatches | Integration | "No role" fallback; no crash |
| T-10.3 | Adapter removed between open and dispatch | Integration | Error message; no crash |
| T-10.4 | Same engineer assigned to all three roles | Unit | Allowed; no conflict (different prompt/task role) |
| T-10.5 | Same adapter assigned to all three roles | Integration | Three separate processes spawned with same command |
| T-10.6 | Rapid Dispatch All → Kill All → Dispatch All | Integration | State transitions cleanly; no orphaned listeners |
| T-10.7 | Feature missing harnessAssignments field | Unit | All sheets initialize with empty defaults |
| T-10.8 | Modal opened from Issues tab (issue dispatch, not feature) | Integration | Three-sheet layout works for issue-based dispatch too |

---

## Test File Mapping

| Test file | Covers |
|---|---|
| `__tests__/RoleConfigPanel.test.tsx` | T-1.* |
| `__tests__/TaskDispatchModal.sheet.test.tsx` | T-2.*, T-3.*, T-9.* |
| `__tests__/TaskDispatchModal.dispatch.test.tsx` | T-4.*, T-5.* |
| `__tests__/TaskDispatchModal.logs.test.tsx` | T-6.* |
| `__tests__/columns.pwe-chips.test.tsx` | T-7.* |
| `__tests__/TaskDispatchModal.kill.test.tsx` | T-8.* |
| `__tests__/TaskDispatchModal.edge.test.tsx` | T-10.* |

---

## Acceptance Criteria Mapping

| Feature Spec Requirement | Test IDs |
|---|---|
| FR-1: Three-Sheet Tab Layout | T-2.1, T-2.2, T-2.3, T-2.4, T-2.5 |
| FR-2: RoleConfigPanel | T-1.1 — T-1.10 |
| FR-3: Per-Role State Management | T-3.1 — T-3.5 |
| FR-4: Dispatch All | T-4.1 — T-4.7 |
| FR-5: Per-Role Dispatch | T-5.1 — T-5.6 |
| FR-6: Unified Log Panel | T-6.1 — T-6.8 |
| FR-7: Running-State Chips | T-7.1 — T-7.8 |
| FR-8: Type Extensions | Covered implicitly by T-4, T-5, T-7 (TypeScript compilation) |
| FR-9: Kill Support | T-8.1 — T-8.6 |
| FR-10: State Cleanup | T-9.1 — T-9.5 |

---

## Verification Commands

```bash
# Unit + integration tests
npx jest --testPathPattern="RoleConfigPanel|TaskDispatchModal|columns.pwe" --verbose

# Type check
npm run typecheck

# Static build (ensures no SSR/import issues)
npm run build
```

## Tests That Should Fail Before Implementation

All T-* tests will fail initially because:
- `RoleConfigPanel.tsx` does not exist yet.
- `TaskDispatchModal` does not have sheet layout.
- `columns.tsx` P/W/E chips have no running-state logic.
- `FeatureHarnessAssignment` lacks `activePid` and `status` fields.

## Tests That Should Pass After Implementation

All T-* tests listed above. Target coverage: 80%+ on new/modified files.
