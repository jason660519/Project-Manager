# F36 TDD Specification

## Suite A: Development sheet metadata

| Case | Input | Expected |
| --- | --- | --- |
| A1 | `.project-manager/config.json` | F36 exists with phase `development` and status `in_progress` |
| A2 | F36 paths | README, feature spec, TDD spec, test scenarios, and dev log files exist |
| A3 | Dashboard document labels | Paths use canonical artifact filenames, not prose-only notes |

## Suite B: Route-level lazy loading

| Case | Route/View | Expected |
| --- | --- | --- |
| B1 | `currentView="dashboard"` | Project dashboard renders without needing xmux-only component imports at initial render |
| B2 | `currentView="xmux"` | Lazy Xmux view renders after dynamic import resolves |
| B3 | `currentView="keys"` with `keysSheet` | Keys view receives the selected sheet prop |
| B4 | `currentView="documentation"` with slug | Documentation view receives manifest and slug props |
| B5 | `currentView="chat"` with assistant sheet | Chat/AI assistant route keeps existing assistant-sheet behavior |
| B6 | dynamic loading state | Loading placeholder uses compact shell styling and accessible text |

## Suite C: User interaction regression tests

| Scenario | Test Level | Expected |
| --- | --- | --- |
| User opens dashboard from cold start | Component/integration | Dashboard metrics and phase tabs still render |
| User switches from dashboard to xmux | Component/manual | Xmux loads without blank page and keeps workspace fallback visible when no projects are selected |
| User opens `/keys/llm-arena` | Component/integration | Keys sheet selection is preserved |
| User opens `/documentation/guides/features/xmux` | Component/integration | Documentation view selects the slug and renders markdown content |
| User opens AI Assistants page | Component/integration | Assistant sheet selection is preserved |
| User opens Settings/Logs/Sessions/Cron Jobs | Component/integration | Utility views still render under AppShell |

## Suite D: xmux runtime smoothness follow-up guards

| Case | Behavior | Expected |
| --- | --- | --- |
| D1 | Split resize drag | Ratio updates are RAF-throttled and native painting resumes after mouseup/blur |
| D2 | Browser tab inactive | Native browser slot is hidden and does not continue visible bounds sync |
| D3 | Workspace switch | Previous workspace layout persists without blocking pointer interaction |
| D4 | Folder/terminal/browser tabs | Lazy route splitting does not destroy registry-backed sessions |

## Manual Verification

| ID | User scenario | Steps | Expected |
| --- | --- | --- | --- |
| F36-M01 | Dashboard first load | Open `/project-progress-dashboard` | Dashboard becomes interactive and active nav is correct |
| F36-M02 | xmux route load | Open `/xmux` | Loading placeholder, if visible, is brief; xmux shell renders |
| F36-M03 | xmux pane resize | In Tauri/dev browser, resize a split pane | Pointer remains responsive; browser chrome remains visible |
| F36-M04 | Keys deep link | Open `/keys/llm-arena` | LLM Arena sheet is selected |
| F36-M05 | Docs deep link | Open `/documentation/guides/features/xmux` | Correct documentation content is selected |
| F36-M06 | Bundle baseline | Run production build before and after | Chunk-size delta is recorded in dev log |

## Regression Guards

- Do not remove user-facing routes.
- Do not hide failed, empty, blocked, or missing-project states behind lazy loading.
- Do not introduce browser-only imports into server components.
- Do not change Tauri command contracts.
- Do not delete dependencies as part of this first slice.
