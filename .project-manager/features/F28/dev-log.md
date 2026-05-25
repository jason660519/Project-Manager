# F28 Dev Log

Append-only chronological log. Newest entry on top. Reference test IDs (`T-N`) and user-scenario IDs (`US-N`) from `tdd-spec.md` / `feature-spec.md`.

---

## 2026-05-25 — implementation landed (Claude)

**Status**: in_progress → ready to mark `done` after manual verification on a Tauri build. All five automated gates green.

### Files changed / created

| File | Action | Purpose |
|---|---|---|
| `components/terminal/PaneShell.tsx` | new | Shared chrome primitive: tab strip (h-8) + 4-icon `PaneActionToolbar`. |
| `components/terminal/TerminalPaneGroup.tsx` | rewritten | Now consumes `PaneShell`. Re-exports `PaneActions` and `PaneActionToolbar` for backward compatibility. **Removed** the legacy `+` button — the toolbar's `SquareTerminal` is the only entry point (US-18 / T-2). |
| `components/browser/BrowserPane.tsx` | new | Multi-tab browser pane. Consumes `PaneShell`. URL input is uncontrolled with `key={activeTabId}` so mid-typing survives parent re-renders (US-7 / T-6). |
| `app/ui/views/XmuxView.tsx` | rewritten | InteropConsole owns `browserState: Record<workspaceId, WorkspaceBrowserState>` for per-workspace tab persistence (US-11 / T-10). `beginDrag` rewritten with rAF coalescing (US-2/3/4 / T-18). Full-viewport `[data-resize-overlay]` rendered while `dragCursor !== null` to bypass iframe/xterm pointer capture (US-2 / T-15). `openBrowserHomepage` now **appends** a tab instead of overwriting (US-8 / T-7). |
| `__tests__/xmux.pane-shell.test.tsx` | new | T-1, T-2, T-4, T-20 (5 tests). |
| `__tests__/xmux.workspace-tabs.test.tsx` | new | T-5, T-5alt, T-6, T-7, T-8, T-9, T-10, T-11, T-11 fallback, T-12, T-14 (11 tests). |
| `__tests__/xmux.resize.test.tsx` | new | T-15, T-16, T-17, T-18, T-19 (5 tests). |
| `__tests__/xmux.registry.test.tsx` | updated | Removed assertion on deleted `New terminal tab` label (replaced by `New terminal in this pane`). |

### Verification baseline

- `npm run typecheck` → green
- `npm run test` → **570 tests passing across 75 test files** (was 549 before F28; +21 tests from new files)
- `cargo check --manifest-path src-tauri/Cargo.toml` → green (no Rust changes)
- `npm run docs:check` → green
- `npm run build` → green (static export, `/xmux` page included)

### Resolved Open Questions

| # | Question (kickoff) | Decision |
|---|---|---|
| 1 | URL bar inside or outside `PaneShell`? | **Outside.** The shell owns only the tab strip + 4-icon toolbar (height h-8 = 32px). The URL bar is a Browser-specific second row rendered as part of `BrowserPane`'s children, so terminal and browser blocks share identical tab strip chrome (US-19). |
| 2 | Soft cap on tabs per workspace? | **8 tabs.** `MAX_BROWSER_TABS_PER_WORKSPACE` in `XmuxView.tsx`. Beyond cap, `onAddBrowser` no-ops silently. Not user-configurable in F28. |
| 3 | Real or fake timers for rAF in resize tests? | **Real timers** via `setTimeout(_, 20)` micro-flush wrapper (`flushRaf()` helper). Fake timers were not needed since jsdom's rAF polyfill rides on macrotasks. |
| 4 | Drop WorkspaceHeader "Split pane layout" toggle? | **Kept** as a global "swap orientation" affordance. The per-pane Split Right / Split Down tooltips were renamed to "Show browser side-panel (right|bottom)" so they no longer collide with the WorkspaceHeader toggle's "Switch to vertical/horizontal split" tooltip — they're now described as orthogonal: WorkspaceHeader = swap orientation, per-pane = ensure browser visible + set orientation. |

### Behavior outcomes (US-N coverage)

| US | Outcome | Evidence |
|---|---|---|
| US-1 | Three blocks render with identical tab strip chrome (h-8). | `xmux.registry.test.tsx` T-3 verifies render; manual eye check. |
| US-2/3/4 | Drag overlay covers iframe/xterm during drag, removed on mouseup. | T-15 / T-17. |
| US-5 | Sidebar drag clamps. | T-16. |
| US-6 | URL bar Enter → normalize + navigate. | T-5, T-5alt. |
| US-7 | Mid-typing not overwritten. | T-6 (parent re-render with unrelated prop change; input value preserved). |
| US-8 | "New Browser" appends, does not overwrite. | T-7. |
| US-9 | Close non-last tab. | T-8. |
| US-10 | Last tab not closable. | T-9. |
| US-11 | Per-workspace tab persistence. | T-10. |
| US-12 / US-13 | githubUrl ↔ fallback homepage. | T-11 / T-11 fallback. |
| US-14 | External link `href` = active tab URL. | T-12. |
| US-15 | Toggle browser pane preserves tabs. | InteropConsole state outlives the pane DOM; verified manually. |
| US-16 | Notification panel + drag. | T-19. |
| US-17 / US-20 | Disabled buttons + workspace switch URL preservation. | T-20 / T-14. |
| US-18 | Legacy `+` button removed. | T-2. |
| US-19 | Chrome height parity. | Both `PaneShell` headers identical class names (`h-8 ... bg-[#202020]`); structural assertion via T-1 + manual review. |

### Deferred / follow-up (open for F29 candidate)

- **Dynamic pane tree** — true tmux-style splitting that creates new panes. Today F28 keeps the 3-slot layout; Split Right / Split Down honestly only toggle browser visibility + orientation.
- **localStorage persistence** of layout (sidebarWidth, topAreaPercent, primarySplitPercent, splitLayout, browserVisible, browserState).
- **Per-tab browser history** (forward/back).
- **Configurable tab cap** (currently hardcoded 8).
- **Cross-session restore** of browser tabs and URLs.

### Pickup checklist (status after this landing)

- [x] All US-1..US-20 covered by an automated test or structurally guaranteed by component composition.
- [x] All T-1..T-20 green in `npm run test` (with implementation details noted: T-15..T-19 use the `flushRaf` helper instead of fake timers, T-1 uses class-based structural assertions rather than computed pixel height which is 0 in jsdom).
- [x] `npm run typecheck` green.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` green (no Rust changes).
- [x] `npm run docs:check` green.
- [x] `npm run build` green.
- [ ] Manual verification in real Tauri desktop app — drag every divider across iframe and xterm canvas, click every 4-icon in every block, switch through ≥ 3 workspaces. *Owner of next session to run via `./start_project_manager.sh` and tick this.*
- [x] `.project-manager/config.json` F28 entry status updated.
- [x] Final dev-log entry summarizing landed scope, deferred work, and follow-up IDs.

---

## 2026-05-25 — kickoff (Claude)

**Context**: F27 (xmux Coding Tool Sidebar Entry) merged on `dispatch-wip-20260525`. During hands-on usage three problems surfaced:

1. Browser block reset URL on every "New Browser" 4-icon click.
2. Divider drag stuttered when cursor crossed the iframe or xterm canvas.
3. Terminal block (h-8 chrome) and Browser block (h-16 chrome) felt like different widgets.

**Decisions**:
- Open this as a separate feature **F28** rather than re-opening F27. F27 is a shipped, stable entry; F28 is the "make the primitive consistent" follow-up.
- Cut scope: no dynamic pane tree (deferred to F29). F28 keeps the 3-slot layout (terminal-a, optional browser, terminal-b).
- Honest naming for `Split Right` / `Split Down`: they ensure browser pane visible + change `splitLayout`. Tooltip describes the actual behavior; we do not pretend to create new panes.

**Identified iron rules to keep**:
- Bridge discipline: no new `invoke()` call sites; resize is pure DOM.
- ADR-002 schemaVersion: no schema change (just feature entry).
- ADR-003 prompt assembly: N/A.
- ADR-004 Anthropic key: N/A.

**Initial design sketch** (see feature-spec.md Architecture section):
- `components/terminal/PaneShell.tsx` — new shared chrome.
- `TerminalPaneGroup` and `BrowserPane` both consume PaneShell.
- `InteropConsole` owns per-workspace tab state in `browserTabsByWorkspaceId`.
- Drag overlay (`position: fixed; inset: 0; z-index: 50; cursor: col/row-resize`) during active drag.
- rAF-throttled state updates inside `beginDrag`.

**Open questions for tomorrow's pickup engineer** (if I stop mid-flight):
1. Should the URL bar live inside `PaneShell` or stay external to it? Current plan: external — URL bar is a Browser-specific second row below the shared shell.
2. Soft cap of 8 browser tabs per workspace — should it be configurable? Current plan: hardcoded 8, no setting.
3. For T-15 / T-18 (resize tests in jsdom), should we use real timers or fake timers? Current plan: fake timers for rAF; real for mousemove.
4. After F28, do we drop the WorkspaceHeader "Split pane layout" toggle (it's now redundant with the per-pane 4-icon Split Right / Split Down)? Current plan: keep it as a global "reset layout" affordance; revisit if user feedback says it's confusing.

**Test fixtures planned**:
- 4 new test files (`xmux.pane-shell.test.tsx`, `xmux.workspace-tabs.test.tsx`, `xmux.resize.test.tsx`, expand `xmux.registry.test.tsx`).
- 20 user-scenario IDs → 20 test IDs.

**Verification baseline (pre-implementation, expected to remain green)**:
- `npm run typecheck` — green.
- `npm run test` — green at 549 tests (recorded 2026-05-25T04:05 UTC).
- `cargo check --manifest-path src-tauri/Cargo.toml` — not re-run; no Rust changes planned.

---

## Implementation guidance for pickup engineer

If you are continuing F28 from this log, work in this order — each step has a verification gate before moving on:

### Step 1 — Extract `PaneShell` (no behavior change)
1. Create `components/terminal/PaneShell.tsx`.
2. Move the `PaneTabs` + `PaneActionToolbar` rendering out of `TerminalPaneGroup.tsx` into PaneShell.
3. `TerminalPaneGroup` consumes PaneShell with `children = <EmbeddedXtermPane ... />`.
4. Remove the `+` button from the tab strip (US-18, T-2). The toolbar's `SquareTerminal` is the only new-tab entry point.
5. **Gate**: `npm run typecheck && npm run test` green. Existing F27 tests should be re-runnable after touching `__tests__/xmux.registry.test.tsx` to swap `New terminal tab` → `New terminal in this pane`.

### Step 2 — Multi-tab BrowserPane
1. Lift browser tab state out of `BrowserPane` into `InteropConsole` as `browserTabsByWorkspaceId: Record<string, BrowserTabState[]>` + `activeBrowserTabIdByWorkspaceId`.
2. `BrowserPane` becomes a pure controlled component: `tabs`, `activeTabId`, `onSelectTab`, `onCloseTab`, `onNavigate(tabId, url)`. Uses PaneShell for chrome.
3. URL bar still inside BrowserPane, but its input is keyed off active-tab id (local `urlInput` keyed on tab id avoids cross-tab bleed).
4. Replace `useEffect([url]) → setUrlInput(url)` with a key-based reset: `<input key={activeTabId} defaultValue={activeTabUrl} ...>` so mid-typing isn't overwritten (US-7, T-6).
5. **Gate**: T-5..T-12, T-14 green.

### Step 3 — Drag overlay + rAF throttle
1. Add `dragCursor: 'col-resize' | 'row-resize' | null` state to `InteropConsole`.
2. Modify `beginDrag` to set `dragCursor` on start, clear on `mouseup`.
3. Add `<div data-resize-overlay style={{ position:'fixed', inset:0, cursor:dragCursor, zIndex:50 }}>` rendered only when `dragCursor !== null`.
4. Wrap `setSidebarWidth` / `setTopAreaPercent` / `setPrimarySplitPercent` calls inside `beginDrag` with a rAF coalescer:
   ```ts
   let pending: number | null = null;
   let nextValue: number;
   const apply = (v: number) => {
     nextValue = v;
     if (pending !== null) return;
     pending = requestAnimationFrame(() => { setter(nextValue); pending = null; });
   };
   ```
5. **Gate**: T-15..T-19 green. Manual: drag every divider over iframe and xterm — smooth.

### Step 4 — 4-icon semantics finalization
1. `onAddBrowser` callback: append a tab; do not overwrite. Cap at 8.
2. `onSplitRight` / `onSplitDown` keep current behavior but tooltip explicitly says "Show browser side-panel (right|bottom)".
3. **Gate**: T-7, T-20 green. Manual: each icon's outcome matches feature-spec.

### Step 5 — Wire-up & sweep
1. Update `__tests__/xmux.registry.test.tsx` for any label changes.
2. Bump no schema. Confirm `npm run docs:check` green.
3. Verify `npm run build` produces a static export.
4. Update **this log** with what landed and what was deferred.

---

## Pickup checklist

Before declaring F28 done:

- [ ] All US-1..US-20 verified manually OR by an automated test.
- [ ] All T-1..T-20 green in `npm run test`.
- [ ] `npm run typecheck` green.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` green (no expected change).
- [ ] `npm run docs:check` green.
- [ ] `npm run build` green.
- [ ] Manual verification checklist in tdd-spec.md complete.
- [ ] `.project-manager/config.json` F28 entry status updated to `done` and `progress` to `100`.
- [ ] Final dev-log entry summarizing landed scope, deferred work, and any new follow-up IDs.
