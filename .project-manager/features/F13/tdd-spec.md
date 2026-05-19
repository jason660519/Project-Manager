# F13 TDD Spec — Dispatch UX Improvements & Bug Fixes

## Test Suites

### Suite A — TaskDispatchModal States (`TaskDispatchModal.state.test.tsx`)

| # | Test | Expected |
|---|---|---|
| A1 | Loading spinner while spec file loads | Spinner visible, textarea disabled |
| A2 | Error banner on adapter build failure | Inline error in modal body, phase=error |
| A3 | Empty adapters list renders message | "No available adapters" text, close-only |
| A4 | Kill button shows confirmation dialog | Modal with PID + feature name, Confirm/Cancel |
| A5 | Kill confirm cancelled keeps modal open | Modal remains in running state |
| A6 | Missing assigned adapter → fallback to first | First adapter selected, warning banner shown |
| A7 | Command not found indicator | Red dot or "Command not found" label |
| A8 | MCP load spinner | Spinner shown while loading |
| A9 | MCP empty state shows "No MCP servers" | Text shown, not "0 servers" |
| A10 | MCP load error shows banner | Inline error banner in modal |
| A11 | MCP re-validates on project root change | Loading triggered on root change |

### Suite B — BatchDispatchModal States (`BatchDispatchModal.state.test.tsx`)

| # | Test | Expected |
|---|---|---|
| B1 | Empty features list → close-only modal | No features shown, close button, no dispatch |
| B2 | No agent adapters → message shown | "Need at least one agent" text |
| B3 | Per-item error state shows inline | Error phase item shows error marker + log |
| B4 | All items completed renders summary | done/error counts visible |
| B5 | Parallel spawn failure → per-item error | Individual items show error, others unaffected |

### Suite C — Adapter Availability (`adapters/availability.test.ts`)

| # | Test | Expected |
|---|---|---|
| C1 | `checkCommandExists('cursor')` — installed | Returns true |
| C2 | `checkCommandExists('nonexistent-tool')` — missing | Returns false |
| C3 | `checkCommandExists` caches results | Second call returns cached value |
| C4 | `checkCommandExists` with empty string | Returns false |
| C5 | Adapter fallback with null adapters | Returns undefined gracefully |

## Behavioral Requirements

### Kill Confirmation Flow
```typescript
// AC-4
it('shows kill confirmation dialog with PID and feature name', async () => {
  // Start dispatch
  await userEvent.click(screen.getByText('Dispatch'));
  // Open kill confirmation
  await userEvent.click(screen.getByText('Kill'));
  // Dialog visible
  expect(screen.getByText(/PID \d+/)).toBeInTheDocument();
  expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
  // Cancel
  await userEvent.click(screen.getByText('Cancel'));
  expect(screen.getByText('Dispatch')).toBeInTheDocument();
});

it('kills process when confirmation confirmed', async () => {
  killProcessMock.mockResolvedValueOnce();
  await userEvent.click(screen.getByText('Dispatch'));
  await userEvent.click(screen.getByText('Kill'));
  await userEvent.click(screen.getByText('Confirm'));
  expect(killProcessMock).toHaveBeenCalled();
});
```

### Adapter Fallback Flow
```typescript
// AC-5
it('falls back to first available adapter when assigned adapter is missing', () => {
  const adapters = [
    { id: 'claude-code', name: 'Claude Code', type: 'agent', command: 'claude' },
    { id: 'codex', name: 'Codex', type: 'agent', command: 'codex' },
  ];
  const feature = { ...MOCK_FEATURE, promptConfig: { agentId: 'nonexistent' } };
  const initialId = resolveInitialAdapterId(feature, adapters, [], 'Cursor');
  expect(initialId).toBe('claude-code');
});
```

## Coverage Target

| Category | Target |
|---|---|
| Modal state transitions | 90% |
| Kill confirmation flow | 100% |
| Adapter fallback logic | 100% |
| Command availability check | 90% |
| MCP validation states | 90% |
| Bridge error surface | 90% |
