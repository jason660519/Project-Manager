# F26 Feature Spec: PWE Dispatch Harness — Three-Role Sheet Dispatch

## Problem

The current `TaskDispatchModal` uses a single Task Role dropdown to switch between Planner / Worker / Evaluator, but the user can only configure and dispatch **one role at a time**. There is no way to:

1. See all three roles' engineer assignments side by side.
2. Configure P, W, E independently without switching back and forth.
3. Dispatch all three roles in one action ("Dispatch All").
4. Know at a glance which roles are currently running from the development table.

The P/W/E chips in the Dispatch column show static labels but never indicate active execution state.

## Goals

1. Replace the Task Role dropdown with a **BottomSheetTabs** layout containing three sheets: P (Planner), W (Worker), E (Evaluator).
2. Each sheet independently configures: Engineer role, Adapter/Target, Prompt template, Workflow, Advanced options.
3. Provide **Dispatch All** (batch) and per-role **Dispatch** buttons — user chooses flexibility.
4. Merge all roles' execution logs into a **unified log panel** with role-tag prefixes (`[P]`, `[W]`, `[E]`).
5. Extend `FeatureHarnessAssignment` with `activePid` and `status` to track per-role running state.
6. Update the P/W/E chips in `columns.tsx` to show **animated running indicators** when a role's process is active.

## Non-Goals

- Do not change the adapter registry, engineer role management, or prompt template system.
- Do not add orchestration (P finishes → auto-start W → auto-start E). All three run concurrently or independently by user choice.
- Do not change how IDE-type adapters behave (they still open the file, not a managed process).
- Do not persist log history across modal re-opens (logs are ephemeral per dispatch session).

## Architecture Decision

### Sheet layout inside modal (not full-page WorkstationFrame)

The modal is an overlay, not a page. Using `BottomSheetTabs` inside the modal body gives the sheet UX without requiring a full `WorkstationFrame`. The tabs sit at the bottom of the modal's configuration area, above the unified log panel and footer.

### Unified log panel (not per-tab logs)

Three concurrent agents produce interleaved output. A merged log with role-tag prefixes (`[P]`, `[W]`, `[E]`) lets the user see the full timeline. Color-coded prefixes make role identification instant.

### Running state in `FeatureHarnessAssignment` (not in a separate store)

Adding `activePid` and `status` directly to `FeatureHarnessAssignment` keeps the running state co-located with the assignment data. The parent (`MainClient`) already manages `activeRuns[]` for the ops panel, so this supplements rather than replaces that mechanism.

## Current Implementation Evidence

| Component | File | Role |
|---|---|---|
| TaskDispatchModal | `components/table/TaskDispatchModal.tsx` | Current single-role dispatch modal (~1550 lines) |
| P/W/E chips | `app/project-progress-dashboard/_lib/columns.tsx:343-423` | `actionsCol()` renders P/W/E + Dispatch button |
| BottomSheetTabs | `components/sheets/BottomSheetTabs.tsx` | Reusable Excel-style bottom tabs |
| Type definitions | `lib/types/index.ts` | `FeatureHarnessAssignment`, `HarnessTaskRole`, `ActiveRun` |
| Parent state | `app/ui/MainClient.tsx:614-660` | `activeRuns[]`, `handleRunStart/Log/End` |
| Bridge | `lib/bridge/index.ts` | `spawnAgent`, `killProcess`, `onAgentStdout`, `onAgentExit` |

## Functional Requirements

### FR-1: Three-Sheet Tab Layout

The TaskDispatchModal body area splits into:

```
┌─────────────────────────────────────────────┐
│ Header: "Dispatch — F01 My Feature"         │
├─────────────────────────────────────────────┤
│ Phase selector (shared across all roles)    │
├─────────────────────────────────────────────┤
│                                             │
│  [Role Config Panel for active sheet]       │
│  - Engineer role selector                   │
│  - Adapter/Execution target                 │
│  - Model + runtime preview                  │
│  - Prompt template picker + textarea        │
│  - Workflow selector                        │
│  - Advanced (auto-loop, stop condition)     │
│                                             │
├─────────────────────────────────────────────┤
│ ┌─P─┐ ┌─W─┐ ┌─E─┐  (BottomSheetTabs)      │
├─────────────────────────────────────────────┤
│ Unified Log Panel [P] [W] [E] merged        │
├─────────────────────────────────────────────┤
│ Footer: [Close] [Dispatch P] [Dispatch All] │
└─────────────────────────────────────────────┘
```

- Phase selector is **shared** — changing phase applies to all three roles.
- Each sheet tab shows a badge indicator: `●` idle, `▶` running, `✓` done, `✗` error.
- The active sheet determines which role's config panel is visible.

### FR-2: RoleConfigPanel Component

Extract into `components/table/RoleConfigPanel.tsx`. Contains:

- Engineer role selector (dropdown from `engineerRoles[]`)
- Adapter/execution target grouped by IDE / CLI / App
- Model + runtime preview (read-only, derived from selected engineer)
- Prompt template picker (quick-apply buttons)
- Prompt textarea
- Workflow selector (agent CLI only)
- Advanced options: auto-loop, stop condition, max iterations (agent CLI only)
- MCP injection preview (agent CLI only)
- Scope warning (strict mode engineers)

Props:

```typescript
interface RoleConfigPanelProps {
  role: HarnessTaskRole;           // 'planner' | 'worker' | 'evaluator'
  feature: Feature;
  adapters: AnyAdapterConfig[];
  engineerRoles: EngineerRole[];
  projectRoot: string;
  defaultIDE?: IDEId;
  selectedPhase: FeaturePhase;
  // Per-role state (lifted to parent modal)
  selectedRoleId: string;
  selectedAdapterId: string;
  prompt: string;
  selectedWorkflowId: string;
  autoLoop: boolean;
  stopCondition: string;
  maxIterations: number;
  onRoleIdChange: (id: string) => void;
  onAdapterIdChange: (id: string) => void;
  onPromptChange: (text: string) => void;
  onWorkflowIdChange: (id: string) => void;
  onAutoLoopChange: (v: boolean) => void;
  onStopConditionChange: (v: string) => void;
  onMaxIterationsChange: (v: number) => void;
}
```

### FR-3: Per-Role State Management

The modal manages three independent state bundles:

```typescript
interface RoleState {
  selectedRoleId: string;
  selectedAdapterId: string;
  prompt: string;
  selectedWorkflowId: string;
  autoLoop: boolean;
  stopCondition: string;
  maxIterations: number;
  // Execution state
  phase: 'idle' | 'pending' | 'running' | 'done' | 'error';
  activePid: number | null;
  logs: string[];
}
```

Initialised from `feature.harnessAssignments[role]` on mount.

### FR-4: Dispatch All (Batch)

"Dispatch All" iterates over the three role states and, for each role that has a valid adapter selected, calls the dispatch flow (build command → augment MCP → spawn agent). All three `spawnAgent` calls happen concurrently (not sequentially).

Dispatch flow per role:
1. Build assignment patch → `onFeatureUpdate(featureId, patch)`.
2. Build execution prompt (with engineer system prompt, model, workflow).
3. Augment args with MCP servers.
4. `spawnAgent({ command, args, workingDir })` → get PID.
5. Register stdout/exit listeners scoped to that PID.
6. Update role state to `running` with `activePid`.

If a role has no adapter selected, skip it silently. If a role is already running, skip it (don't double-dispatch).

### FR-5: Per-Role Dispatch

Each sheet tab has its own "Dispatch" button in the footer. Clicking it dispatches only that role. This is the same flow as FR-4 but for one role.

Footer button logic:

| Sheet | Buttons shown |
|---|---|
| P tab active | `[Close]` `[Open Terminal]` `[Dispatch P]` `[Dispatch All]` |
| W tab active | `[Close]` `[Open Terminal]` `[Dispatch W]` `[Dispatch All]` |
| E tab active | `[Close]` `[Open Terminal]` `[Dispatch E]` `[Dispatch All]` |

"Open Terminal" is only shown for agent-cli adapters.

### FR-6: Unified Log Panel

Below the sheet tabs, a single log panel shows merged output from all running roles:

```
[P] Reading feature spec...
[W] Starting implementation of auth module...
[P] Plan complete. 3 phases identified.
[E] Waiting for worker output...
[W] Created src/auth/middleware.ts
[E] Running typecheck...
```

- Prefix format: `[P]`, `[W]`, `[E]` with role-specific colors:
  - P: `text-stone-300` (neutral/grey)
  - W: `text-cyan-200` (blue/cyan)
  - E: `text-amber-200` (amber/gold)
- Process exit lines: `── P exited (PID 12345, code 0) ──`
- Auto-scroll to bottom.
- When no roles are running and no logs exist, show placeholder: "Dispatch one or more roles to see output here."

### FR-7: Running-State P/W/E Chips

In `columns.tsx` `actionsCol()`, update the P/W/E chip rendering:

**Idle (no assignment):**
```
┌────────────────┐
│ P  —           │  border-stone-200/15 bg-stone-500/10
└────────────────┘
```

**Assigned but not running:**
```
┌────────────────┐
│ P  Jason       │  border-stone-200/15 bg-stone-500/10 (current style)
└────────────────┘
```

**Running:**
```
┌────────────────┐
│ P ● Jason      │  border-emerald-300/30 bg-emerald-500/15 + animate-pulse on ●
└────────────────┘
```

**Done (last run succeeded):**
```
┌────────────────┐
│ P ✓ Jason      │  border-emerald-300/25 bg-emerald-500/10 text-emerald-200
└────────────────┘
```

**Error (last run failed):**
```
┌────────────────┐
│ P ✗ Jason      │  border-red-400/30 bg-red-500/15 text-red-200
└────────────────┘
```

Running state is determined by checking `feature.harnessAssignments[role].activePid` against `activeRuns[]` passed from the parent.

### FR-8: Type Extensions

```typescript
// lib/types/index.ts — extend FeatureHarnessAssignment
export interface FeatureHarnessAssignment {
  engineerRoleId?: string;
  assignedIDE?: IDEId;
  assignedTo?: string;
  assignedAt?: string;
  adapterId?: string;
  lastDispatchModel?: string;
  // NEW: running-state fields
  activePid?: number;
  status?: 'idle' | 'running' | 'done' | 'error';
}
```

### FR-9: Kill Support

Each running role can be killed individually:
- In the log panel, each `── P running (PID 12345) ──` line could have a kill button.
- Or: the footer shows a "Kill" button for the active tab's running process.
- Kill confirmation dialog (same pattern as current).
- After kill: role status → `error`, `activePid` → cleared.

### FR-10: State Cleanup on Modal Close

When the modal closes while roles are running:
- Processes continue running in the background (same as current behavior).
- `onRunStart` / `onRunEnd` callbacks continue to fire (listeners are registered on the bridge event bus, not on the modal lifecycle).
- Role assignment data is already persisted via `onFeatureUpdate`.

## User Scenarios

### US-1: First-Time Dispatch — Configure All Three Roles

**Given** a feature with no prior harness assignments.
**When** the user clicks "Dispatch" on a development table row.
**Then** the modal opens with three sheets (P/W/E), all showing "No engineer selected".
**And** the user can navigate between sheets, assign engineers, pick adapters, customize prompts.
**And** clicking "Dispatch All" spawns all three (or only those with valid adapter selections).

### US-2: Dispatch Only Worker

**Given** a feature where only the Worker role matters (simple implementation task).
**When** the user opens the modal, configures only the W sheet, ignores P and E.
**Then** clicking "Dispatch W" dispatches only the worker. P and E remain idle.
**And** the W chip in the table shows the running indicator. P and E chips remain static.

### US-3: Dispatch All — Mixed Adapter Types

**Given** P assigned to Claude Code (agent-cli), W assigned to Cursor (IDE), E assigned to Claude Code (agent-cli).
**When** the user clicks "Dispatch All".
**Then** P spawns a managed agent process. W opens Cursor with the target file. E spawns a managed agent process.
**And** The log panel shows output from P and E (IDE adapters don't produce managed logs).
**And** P and E chips show running indicators. W chip shows assigned-but-not-running (IDE).

### US-4: Resume Previous Configuration

**Given** a feature that was previously dispatched with P=Alice, W=Bob, E=Carol.
**When** the user re-opens the modal.
**Then** each sheet pre-fills from `feature.harnessAssignments[role]`: engineer role, adapter, last prompt.
**And** the user can modify and re-dispatch.

### US-5: Kill One Running Role

**Given** P and W are running. E finished successfully.
**When** the user wants to kill only the Planner because it's stuck.
**Then** the user clicks Kill on the P process (via footer or log panel).
**And** confirmation dialog appears. After confirming, P is killed, P chip shows error state.
**And** W continues running unaffected. E chip shows done state.

### US-6: Monitor Merged Logs

**Given** all three roles are running concurrently.
**When** the user watches the unified log panel.
**Then** logs appear in chronological order with `[P]`, `[W]`, `[E]` prefixes in distinct colors.
**And** auto-scroll keeps the latest output visible.
**And** process exit events show as separator lines per role.

### US-7: Close Modal While Running

**Given** W and E are running.
**When** the user clicks "Close" (or the backdrop).
**Then** processes continue running in the background.
**And** the table's W and E chips still show running indicators (state tracked in `activeRuns[]` and `harnessAssignments`).
**And** re-opening the modal for the same feature shows the running state but does not replay old logs.

### US-8: No Adapters Available

**Given** no adapters are configured in the project.
**When** the user opens the dispatch modal.
**Then** all three sheets show "No available adapters" message.
**And** "Dispatch All" and per-role dispatch buttons are disabled.

### US-9: Assigned Override Warning (Worker Only)

**Given** the Worker role is already assigned and the feature status is `in_progress`.
**When** the user tries to dispatch a new Worker.
**Then** an override warning appears (same as current behavior) asking for confirmation.
**And** This warning only applies to the Worker role (P and E don't set feature-level `assignedTo`).

### US-10: Switch Tabs While Running

**Given** the user dispatched P from the P sheet and it's running.
**When** the user switches to the W sheet tab.
**Then** the W sheet shows its own config (not P's). The unified log panel below continues showing all role logs. The P tab badge shows `▶` running indicator.

### US-11: Dispatch All With Partial Configuration

**Given** P has an engineer and adapter selected. W has no adapter selected. E has an engineer and adapter.
**When** the user clicks "Dispatch All".
**Then** P and E are dispatched. W is skipped silently. The log panel shows output from P and E only.
**And** A brief toast or inline note indicates "W skipped — no adapter selected".

### US-12: IDE Adapter on Any Role

**Given** the user assigns an IDE adapter (e.g., Cursor) to the Planner role.
**When** the user dispatches P.
**Then** Cursor opens with the feature's target file (same as current IDE behavior).
**And** No managed log output appears for P. P chip shows "assigned" but not "running" (IDE processes are external).

## Affected Files

| File | Change |
|---|---|
| `lib/types/index.ts` | Extend `FeatureHarnessAssignment` with `activePid`, `status` |
| `components/table/TaskDispatchModal.tsx` | Major rewrite: three-sheet layout, batch dispatch, unified log |
| `components/table/RoleConfigPanel.tsx` | **NEW**: extracted per-role configuration form |
| `app/project-progress-dashboard/_lib/columns.tsx` | Update P/W/E chips with running-state indicators |
| `app/ui/MainClient.tsx` | Pass `activeRuns` to columns for running-state lookup |
| `app/project-progress-dashboard/ProjectProgressClient.tsx` | Thread `activeRuns` to columns/PhaseTabContent |
| `app/project-progress-dashboard/_components/PhaseTabContent.tsx` | Accept and forward `activeRuns` |

## Open Questions

1. Should "Dispatch All" have a confirmation dialog or execute immediately? — **Decision: execute immediately, since each role is already explicitly configured.**
2. Should the sheet tabs show the engineer name as badge text? — **Decision: show status icon only (`●` / `▶` / `✓` / `✗`) to keep tabs compact.**
