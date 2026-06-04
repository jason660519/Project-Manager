# F17 TDD Spec - Decoupled Mermaid Integration

## Test Strategy

F17 needs both parent-side React tests and real browser smoke because jsdom cannot execute the sandbox iframe or Mermaid SVG layout. The automated unit layer protects message protocol behavior; browser smoke protects actual diagram rendering and cross-engine layout.

## Unit And Integration Tests

### `mermaidBlock.rendering.test.tsx`
- [x] Renders the sandboxed iframe with `src="/vendor/mermaid/index.html"` and `sandbox="allow-scripts"`.
- [x] Correctly posts message with diagram code to the iframe upon ready.
- [x] Listens to incoming `resize` event and adjusts iframe height.
- [x] Handles syntax errors by rendering an error display block.
- [ ] Ignores resize/error messages from unrelated diagram instances.
- [ ] Ignores `ready` messages from a different iframe source.
- [ ] Sends a new render command when `code` changes after the iframe is ready.
- [ ] Keeps an accessible title/label for the embedded diagram frame.
- [ ] Shows bounded loading or degraded state before the first successful resize.

### Vendor Renderer Smoke

Add browser-level coverage or a small Playwright fixture page that mounts representative `MermaidBlock` instances.

- [ ] Flowchart fixture returns a non-zero iframe height and visible SVG.
- [ ] Sequence diagram fixture returns a non-zero iframe height and visible SVG.
- [ ] Gantt fixture returns a non-zero iframe height and visible SVG.
- [ ] State diagram fixture returns a non-zero iframe height and visible SVG.
- [ ] Class diagram fixture returns a non-zero iframe height and visible SVG.
- [ ] Architecture diagram fixture either renders or emits a visible unsupported/syntax diagnostic.

## User Scenario Coverage Map

| Scenario | Level | Expected Coverage |
| --- | --- | --- |
| External visitor opens docs page with diagrams | Browser smoke | `/documentation` route renders diagrams with no user setup |
| Maintainer opens feature doc panel | Component/manual | `FeatureDocPanel` renders MermaidBlock for code fences |
| Multiple diagrams on one page | Unit/browser | instance ids prevent cross-resize and stale error leakage |
| Syntax error in user-authored Mermaid | Unit/browser | diagnostic block appears inline |
| Offline mode | Static asset check/manual | no CDN URLs required by iframe renderer |
| Tauri desktop rendering | Manual | WKWebView shows diagrams and no runtime bridge exposure |

## Manual Verification

| ID | Browser / Surface | Steps | Expected |
| --- | --- | --- | --- |
| F17-M01 | Chrome or Edge | Open a docs page with all fixture diagrams | All valid diagrams render, no install prompt, no console runtime errors |
| F17-M02 | Firefox | Repeat fixture page smoke | Diagrams scale within content column |
| F17-M03 | Safari or WebKit | Repeat fixture page smoke | No blank iframe; height is stable |
| F17-M04 | Tauri WebView | Open documentation and feature doc panel | Diagrams render and app bridge remains inaccessible from iframe |
| F17-M05 | Invalid Mermaid | Open fixture with broken syntax | Visible diagnostic replaces blank diagram |

## Completion Gate

- `npm run test -- __tests__/mermaidBlock.rendering.test.tsx`
- `npm run typecheck`
- Browser smoke for changed documentation route
- `npm run verify:baseline` before claiming complete
