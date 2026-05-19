# F13 Feature Spec — Dispatch UX Improvements & Bug Fixes

## Problem Statement

The Task Dispatch modal (`TaskDispatchModal.tsx`) and Batch Dispatch modal
(`BatchDispatchModal.tsx`) currently lack handling for several critical UX
states: loading indicators during command assembly, error feedback when
adapter commands fail or are missing, empty states when no adapters are
configured, and kill-before-dispatch confirmation. These gaps degrade the
operator experience and can silently swallow failures.

## User Stories

1. **Loading State** — As an operator, I should see a loading indicator while
   the dispatch modal assembles the command, reads spec files, or checks MCP
   server availability so I know the app is working, not frozen.
2. **Error Feedback** — As an operator, I should see inline error messages
   when an adapter command fails to build, an adapter is not found, or the
   project root is invalid.
3. **Empty State** — As an operator, when no adapters are configured for the
   selected context, I should see a clear message rather than a broken modal.
4. **Kill Confirmation** — As an operator, I should see a confirmation dialog
   before terminating an active dispatch to prevent accidental kills.
5. **Adapter Not Found** — As an operator, if a previously assigned adapter
   is no longer configured, I should see a clear message and fall back to
   the first available adapter.
6. **Command Availability** — As an operator, I should see a visual indicator
   if the selected adapter's command binary is not installed on the system.
7. **MCP Validation** — As an operator, I should see a loading/error state
   while MCP server configuration is being validated before injection.

## Acceptance Criteria

### AC-1: Loading States
- [ ] Spec file reading shows spinner instead of blank textarea
- [ ] MCP server enumeration shows spinner during discovery
- [ ] Command assembly shows spinner while building args

### AC-2: Error Feedback
- [ ] Adapter build failure shows inline error message (not console-only)
- [ ] Bridge call failures shown in modal body (not swallowed in catch)
- [ ] Network/MCP injection errors shown with retry affordance

### AC-3: Empty State
- [ ] If `features.length === 0`, modal explains and provides close-only
- [ ] If no adapters match the filter, modal shows "No available adapters"

### AC-4: Kill Confirmation
- [ ] Kill button opens a confirmation dialog showing PID and feature name
- [ ] Confirmation can be confirmed (kill) or cancelled (continue)
- [ ] Modal stays open if confirm is cancelled

### AC-5: Adapter Fallback
- [ ] Missing adapter from `assignedTo` → fall back to first available
- [ ] Warning banner shown with original adapter name

### AC-6: Command Availability
- [ ] Visual indicator (red dot / text) when `which <command>` returns empty
- [ ] Check runs once on mount with caching (not on every render)
- [ ] Tooltip or note: "Command not found on PATH"

### AC-7: MCP Validation
- [ ] MCP load spinner shown while collecting servers
- [ ] Empty MCP state: "No MCP servers configured" (not count=0)
- [ ] MCP load error: inline banner with error message
- [ ] MCP server re-validation when project root changes

## Non-Negotiables

1. Do not change adapter registry types or schema.
2. Do not add new Tauri commands (bridge discipline, ADR-004).
3. Keep localization through existing i18n keys; extend key set where needed.
4. No silent failures — every catch block must update modal state.
