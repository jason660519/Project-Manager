# F02 Feature Filter Tabs - TDD Spec

## Test Target

Primary component: app/ui/DashboardClient.tsx

Tests should use Vitest, React Testing Library, and @testing-library/user-event, consistent with the existing test stack.

## Shared Fixtures

Create a small feature fixture set containing at least:

- Two Development features: one explicit phase: 'development', one with no phase.
- One E2E Testing feature: phase: 'e2e_testing'.
- One Deployment feature: phase: 'deployment'.
- One Operations feature: phase: 'operations'.

Use minimal valid project/adapters/run props required by DashboardClient. Mock or stub child table behavior only if necessary; prefer asserting visible feature names through the rendered table when stable.

## Suite A - Tab Rendering and Click Behavior

### A1: Renders the four lifecycle tabs

- Render DashboardClient.
- Assert tabs are present with labels:
  - Development
  - E2E Testing
  - Deployment
  - Operations
- Assert Development is selected by default when no URL or storage value exists.

### A2: Filters the feature list by selected tab

- Start on Development.
- Assert Development features are visible and non-Development features are not visible.
- Click E2E Testing.
- Assert only E2E Testing features are visible.
- Click Deployment and Operations and verify each tab filters to its own phase.

### A3: Missing feature phase defaults to Development

- Include one feature without phase.
- Assert it appears under Development.
- Assert it does not appear under E2E Testing, Deployment, or Operations.

## Suite B - Tab Persistence: localStorage

### B1: Saves active phase to project-scoped localStorage

- Render with a project root.
- Click Operations.
- Assert localStorage stores operations under the F02 dashboard phase key for that project.

### B2: Restores active phase from localStorage

- Seed the project-scoped key with deployment.
- Render with no phase URL param.
- Assert Deployment is selected and Deployment features are visible.

### B3: Ignores invalid stored phase

- Seed the project-scoped key with an invalid value.
- Render with no phase URL param.
- Assert Development is selected.

### B4: Handles localStorage errors

- Mock localStorage.getItem and/or setItem to throw.
- Render and click a tab.
- Assert the component does not throw and filtering still works.

## Suite C - URL Search Param Sync

### C1: URL phase takes precedence over localStorage

- Seed localStorage with deployment.
- Set the initial URL to ?phase=e2e_testing.
- Render.
- Assert E2E Testing is selected.

### C2: Clicking a tab updates the URL phase param

- Render at a URL with unrelated params, for example ?foo=bar.
- Click Deployment.
- Assert window.location.search contains phase=deployment.
- Assert unrelated params remain.

### C3: Changing phase preserves dispatch param

- Render at ?dispatch=F03.
- Click Operations.
- Assert dispatch=F03 remains and phase=operations is added.

### C4: Browser back/forward updates selected tab

- Render.
- Click E2E Testing, then Deployment.
- Simulate browser back/popstate to the E2E Testing URL.
- Assert E2E Testing is selected and the E2E feature list is visible.

### C5: Invalid URL phase falls back to Development and syncs URL

- Render at ?phase=bad_value.
- Assert Development is selected.
- Assert the URL is repaired to phase=development or otherwise no longer exposes the invalid phase.

## Suite D - Per-Tab Count Badges

### D1: Shows counts for every phase

- Render the shared fixture set.
- Assert badges show:
  - Development: 2
  - E2E Testing: 1
  - Deployment: 1
  - Operations: 1

### D2: Counts update from incoming features

- Render with an initial fixture set.
- Rerender with an additional Operations feature.
- Assert the Operations badge updates from 1 to 2.

### D3: Count badges use normalized phase values

- Assert the feature without phase contributes to the Development count.

## Suite E - Tab Transition Animation

### E1: Feature list has transition styling

- Render DashboardClient.
- Locate the feature list wrapper.
- Assert it has classes or inline styles representing opacity/transform transition behavior.

### E2: Switching tabs changes animation state without removing content permanently

- Click a non-active tab.
- Assert the selected tab's features become visible after the state update.
- Assert the transition wrapper remains mounted and keeps the table reachable.

This suite may verify style/class presence rather than timing-dependent animation behavior.

## Required Verification

After implementation:

- Run npm test -- --run.
- Run npm run typecheck.
- Both commands must pass before F02 is marked done.
