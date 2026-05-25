# F28 TDD Spec: xmux Pane Unification, Stable Browser State & Smooth Resize

> Test plan derived from `feature-spec.md`. Every US-N scenario in feature-spec maps to at least one test. Test IDs are stable across iterations so dev-log can reference them.

## Test Surfaces

| Surface | Tool | Files |
|---|---|---|
| Component (RTL) | vitest + @testing-library/react | `__tests__/xmux.registry.test.tsx`, `__tests__/xmux.pane-shell.test.tsx` (new) |
| Drag interaction | vitest + jsdom + manual pointer events | `__tests__/xmux.resize.test.tsx` (new) |
| State preservation | vitest | `__tests__/xmux.workspace-tabs.test.tsx` (new) |
| E2E (optional, post-F28) | Playwright | `e2e/xmux.spec.ts` |

## Coverage Targets

- F28-changed code paths: **≥ 90%** lines, **100%** branch on `BrowserPane` tab state transitions and `beginDrag` overlay logic.
- Existing F27 tests must remain green.

---

## Test Matrix (US-N ↔ T-N)

### Pane structure & chrome parity

**T-1** (US-1, US-19) — `xmux.pane-shell.test.tsx`
Render `<PaneShell tabs={[{id:'a',label:'A',active:true}]} actions={{onAddTerminal: jest.fn()}}>content</PaneShell>`. Assert:
- Root has `flex h-full min-h-0 flex-col`.
- Tab strip is exactly h-8 (computed pixel height = 32).
- One tab rendered with `aria-pressed=true`.
- Toolbar contains all four icon buttons with the expected `aria-label` set: `New terminal in this pane`, `New browser tab`, `Split pane to the right`, `Split pane downward`.

**T-2** (US-18) — `xmux.pane-shell.test.tsx`
Render `<TerminalPaneGroup paneId="p" workspaceId="w" cwd="/tmp" />`. Assert there is **no** button with text content `"+"` (the duplicate plus button has been removed). Assert there is exactly one `New terminal in this pane` button.

**T-3** (US-1) — `xmux.registry.test.tsx`
Render `<XmuxView />`. Assert three blocks visible; assert each block's tab strip has identical computed height.

**T-4** (US-17) — `xmux.pane-shell.test.tsx`
Render `<PaneShell ... actions={{ /* no onAddTerminal */ }}>`. Assert `New terminal in this pane` button has `disabled` attribute and `aria-disabled=true`.

### Browser pane state

**T-5** (US-6) — `xmux.workspace-tabs.test.tsx`
Render `<BrowserPane tabs=[{id, url:'about:blank', label:'New Tab'}] activeTabId=... onNavigate=jest.fn() actions={}>`. Type `github.com` in the URL input, fire Enter. Assert `onNavigate` called once with `('id', 'http://github.com')` (the `http://` prefix injected by the input handler).

**T-6** (US-7) — `xmux.workspace-tabs.test.tsx`
Render BrowserPane. Type `partial-input` in URL field. Parent re-renders with unrelated prop change (e.g., increment a counter passed via key-stable prop). Assert URL field input value is still `partial-input` (no `useEffect`-driven reset).

**T-7** (US-8) — `xmux.workspace-tabs.test.tsx`
Wire `InteropConsole` with a single workspace, browser visible, one tab at `github.com`. Click 4-icon Globe in terminal-a pane. Assert browser pane now has **2 tabs**; assert tab-1 URL is still `github.com`; assert tab-2 URL is the workspace homepage; assert active tab is tab-2.

**T-8** (US-9) — `xmux.workspace-tabs.test.tsx`
Browser pane with 3 tabs (a, b, c), active=b. Click close on b. Assert tabs become [a, c]; assert active=c (next-after-closed). Repeat closing b when active=a → tabs become [a, c], active stays a.

**T-9** (US-10) — `xmux.workspace-tabs.test.tsx`
Browser pane with 1 tab. Assert `Close` button is not rendered for that tab.

**T-10** (US-11) — `xmux.workspace-tabs.test.tsx`
Render `<XmuxView projects={[A,B]} selectedDashboardProjectIds={[A.id, B.id]} />`. Click workspace-A: open 2 browser tabs (homepage + navigate one to `github.com`). Click workspace-B: open 1 browser tab (homepage only). Click workspace-A again. Assert 2 tabs present; their URLs preserved (homepage + github.com).

**T-11** (US-12, US-13) — `xmux.workspace-tabs.test.tsx`
Project with `config.project.githubUrl='https://github.com/x/y'` → `deriveHomepage` returns that URL. Project without githubUrl → returns `http://localhost:43187/project-progress-dashboard`.

**T-12** (US-14) — `xmux.workspace-tabs.test.tsx`
Browser pane with 2 tabs, active=tab-2 url=`https://example.com`. External link anchor `href` equals `https://example.com`. Switch active to tab-1 (url=`https://other.com`). Anchor `href` updates to `https://other.com`.

**T-13** (US-15) — `xmux.registry.test.tsx`
Click `Built-in browser` toggle in WorkspaceHeader. Browser pane hides. Click again. Browser pane shows, tab count and URLs preserved (re-mounts at same tab state).

**T-14** (US-20) — `xmux.workspace-tabs.test.tsx`
Workspace-A active, browser tab-1 navigated to `https://github.com`. Switch to workspace-B then back. Assert workspace-A's tab-1 still at `https://github.com` (no force-reload to homepage).

### Resize / drag

**T-15** (US-2, US-3, US-4) — `xmux.resize.test.tsx`
Mount XmuxView in jsdom. Dispatch `mousedown` on the col divider. Assert a `div[data-resize-overlay]` element appears in the DOM with `cursor: col-resize` and full-viewport coverage (`position: fixed; inset: 0`). Dispatch a sequence of `mousemove` events. Dispatch `mouseup`. Assert overlay is removed from the DOM. Assert final `primarySplitPercent` corresponds to the last mousemove x position.

**T-16** (US-5) — `xmux.resize.test.tsx`
Same as T-15 but on the sidebar col divider; final `sidebarWidth` in `[220, 520]` clamp.

**T-17** (US-4) — `xmux.resize.test.tsx`
Same as T-15 but on the row divider between top and bottom; final `topAreaPercent` in `[35, 85]` clamp.

**T-18** (Performance smoke) — `xmux.resize.test.tsx`
Spy on `setSidebarWidth`. Dispatch 20 mousemove events in a single rAF window (mock `requestAnimationFrame` to capture). Assert `setSidebarWidth` called ≤ 2 times (initial coalesced frame + final flush), not 20.

**T-19** (US-16) — `xmux.resize.test.tsx`
Open notification panel. Start drag. Assert overlay is rendered on top of notification panel (z-index check: overlay z >= notification panel z). Finish drag. Assert notification panel still open.

### Disabled-action visual

**T-20** (US-17) — `xmux.pane-shell.test.tsx`
For each of the 4 icon buttons, render a PaneShell without the corresponding callback. Assert the button has `disabled` and `aria-disabled`. Render with the callback wired — assert `disabled` is false.

---

## Test File Layout

```
__tests__/
  xmux.registry.test.tsx        # F27 + T-3, T-13
  xmux.pane-shell.test.tsx      # T-1, T-2, T-4, T-20
  xmux.workspace-tabs.test.tsx  # T-5..T-12, T-14
  xmux.resize.test.tsx          # T-15..T-19
```

Each new test file should include:

```ts
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
```

## Mocking Notes

- `EmbeddedXtermPane` already renders a placeholder when `__TAURI_INTERNALS__` is missing — no mock needed; tests assert on the placeholder text `/Embedded terminal requires/i`.
- `requestAnimationFrame` mocked via `vi.useFakeTimers()` + `vi.advanceTimersByTime()` for T-18.
- `iframe.contentDocument` access not required — tests assert at the React/DOM layer, not inside the iframe.
- `getBoundingClientRect` may need manual mock when measuring drag rect; alternative: rely on jsdom's default 0×0 and assert relative deltas.

## Manual Verification Checklist (post-implementation)

- [ ] Drag every divider with cursor crossing iframe — no stutter.
- [ ] Drag every divider with cursor crossing xterm canvas — no stutter.
- [ ] Click each of the 4 toolbar icons in every block — outcome matches feature-spec semantics.
- [ ] Open 8 browser tabs in one workspace — UI stays usable (tabs may overflow with scrollable strip).
- [ ] Switch between 3+ workspaces — each remembers its tabs.
- [ ] `npm run docs:check` — green.
- [ ] `npm run build` — green (static export).
- [ ] Launch via `./start_project_manager.sh` — desktop app boots, xmux view interactive.

## Out-of-scope Tests (tracked for F29+)

- Persistence across reloads (would require localStorage assertion).
- Real PTY round-trip (requires Tauri-only environment).
- Browser back/forward history (no per-tab history yet).
