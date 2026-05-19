# F02 Feature Filter Tabs - Feature Spec

## Scope

Complete the dashboard feature filter tabs by moving them from status-based filtering to lifecycle phase filtering. The feature list must be filterable by phase, persist the active tab, expose the selected phase in the URL, show phase counts, and animate tab changes subtly.

## Phase Model

The tab set is exactly:

| Label | Feature.phase value | Notes |
| --- | --- | --- |
| Development | development | Default phase for features with no phase value. |
| E2E Testing | e2e_testing | End-to-end acceptance and validation phase. |
| Deployment | deployment | Release, environment, and deploy tracking phase. |
| Operations | operations | Production operations, reliability, and incident tracking phase. |

Unknown or missing phase values must be treated as development for display, count, and persistence recovery.

## Filtering Behavior

- DashboardClient renders one tab per lifecycle phase.
- Selecting a tab filters the Feature Matrix list to features whose normalized phase matches the selected phase.
- There is no "All" tab in F02. The dashboard is phase-focused.
- Row inspection, dispatch, run history, and detail-panel behavior must continue to use the original features collection, not only the filtered list, so a selected row remains resolvable while visible.
- If the active phase has zero features, the matrix should render the empty filtered state already provided by TableCore and the summary text should show "0 features".
- Multi-project dashboards use the same phase tabs and count all features across the selected projects.

## Active Tab Persistence

The selected phase must be shareable through the URL and survive reloads through localStorage.

### Storage

- Store the active phase in localStorage under a project-scoped key.
- The key should include the project identity when available, using project.root as the stable project discriminator.
- If localStorage is unavailable, full dashboard functionality must continue without throwing.
- Invalid stored values must be ignored and replaced with the default phase.

### URL Search Param

- The selected phase must be represented as a URL search parameter named phase.
- Example: /project-progress-dashboard?phase=e2e_testing
- Changing tabs updates phase using the History API without a full page reload.
- Existing unrelated search parameters, including dispatch, must be preserved when the phase changes.
- Browser back/forward navigation must update the active tab from the URL.
- Invalid URL phase values must be ignored and replaced by the default phase.

### Precedence

On initial client render, resolve the active phase in this order:

1. Valid phase URL search param.
2. Valid project-scoped localStorage value.
3. Default phase: development.

After resolution, persist the active phase to localStorage. If the page URL does not have a valid phase value, sync the resolved phase into the URL search param.

## Count Badges

- Each phase tab shows a count badge containing the number of features in that phase.
- Counts are derived from normalized Feature.phase values.
- Features with missing phase values count under Development.
- Badge text must remain readable in active and inactive states.
- Counts update when the features prop changes.

## Transition Animation

- Switching tabs should apply a subtle transition to the feature list area.
- Required effect: short fade with a small vertical or horizontal slide.
- The animation should be implemented with CSS classes/styles compatible with React state changes and existing Tailwind usage.
- Animation must not disrupt table layout, focus handling, row click behavior, or dispatch modal behavior.
- Respect accessible motion expectations by keeping the transition short and subtle. No long or attention-heavy motion.

## Accessibility and UX

- The tab group should use tab semantics where practical: role="tablist", role="tab", and aria-selected.
- Tabs must be buttons, keyboard-focusable, and operable with standard click/keyboard behavior.
- The active phase should be visually distinct.
- Count badges should not be the only active-state indicator.

## Non-Goals

- No schema migration is required.
- No changes to feature editing, dispatch execution, adapters, or run history behavior.
- No changes outside F02 scope unless directly required to test DashboardClient.
