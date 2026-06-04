# F17 Decoupled Mermaid Integration — Dev Log

## 2026-06-04 (Codex)

**Status**: In progress - hardening slice started.

**Kickoff context**:
- User reported that Mermaid diagrams must not require external users to install plugins, browser extensions, npm packages, or Mermaid CLI tooling.
- The recommended approach is to keep the existing vendored Mermaid iframe renderer as the primary runtime path, then add build-time static SVG generation later for public docs performance.
- Reused existing feature ID `F17` because `.project-manager/config.json` already tracks "Decoupled Mermaid Integration".

**Dashboard metadata**:
- Updated F17 to `status: in_progress`, `progress: 10`, `points: 3`.
- Added canonical paths for README, feature spec, TDD spec, test scenarios, and dev log.
- Implementation path remains `components/MermaidBlock.tsx`.
- Focused test path remains `__tests__/mermaidBlock.rendering.test.tsx`.

**Baseline observations**:
- `components/MermaidBlock.tsx` already uses `sandbox="allow-scripts"` and routes renders through `/vendor/mermaid/index.html`.
- `public/vendor/mermaid/index.html` already loads local `mermaid.min.js`.
- `DocumentationView` and `FeatureDocPanel` already route Markdown `mermaid` code fences to `MermaidBlock`.
- Existing tests cover the basic iframe attributes, ready message, resize message, and error message.

**Implementation notes**:
- Added parent-side `requestId` routing so stale render responses cannot resize or error the current diagram.
- Added iframe source filtering for resize/error messages, not only `ready`.
- Kept the iframe mounted during syntax errors so a later code change can recover without remount dead ends.
- Added a module-level Mermaid render queue in `MermaidBlock` so pages with multiple Mermaid blocks render one at a time instead of competing for heavy Mermaid runtime resources.
- Added renderer timeout handling in both the parent component and the sandbox iframe, converting hangs into visible diagnostics.
- Added `securityLevel: 'strict'` and `htmlLabels: false` to the sandbox Mermaid initialization.
- Added `/public/vendor/mermaid/fixtures.html` as a static smoke harness for flowchart, sequence, gantt, swimlane-style flowchart, state, class, and architecture diagrams.
- Added `__tests__/mermaidVendor.fixture.test.ts` to guard local vendored assets, conservative renderer config, and fixture inventory.

**Planned implementation**:
1. Harden `MermaidBlock` against stale/unrelated messages and code changes after iframe readiness.
2. Harden `public/vendor/mermaid/index.html` with explicit conservative Mermaid security settings and more reliable size reporting.
3. Add representative fixture coverage for flowchart, sequence, swimlane-style flowchart, gantt, state, class, and architecture diagrams.
4. Add parent-side unit tests for multiple instances, stale messages, and rerender-on-code-change.
5. Add or document browser smoke for public documentation routes and Tauri/WebKit manual verification.

**Verification log**:
- `npm run test -- __tests__/mermaidBlock.rendering.test.tsx` - pass, 4 tests.
- `npm run test -- __tests__/mermaidBlock.rendering.test.tsx __tests__/mermaidVendor.fixture.test.ts` - pass, 7 tests.
- Browser smoke via `/vendor/mermaid/fixtures.html` - pass for flowchart, sequence, gantt, swimlane-style flowchart, state, class, and architecture in Chromium, Firefox, and WebKit headless Playwright.
- Browser smoke via `/documentation/guides/features/agent-workflows` - pass after render queue; all 4 Mermaid iframes reached visible non-1px heights (`1240px`, `175px`, `253px`, `390px`).
- `npm run typecheck` - pass.
- `npm run verify:dev-issues -- --routes /documentation/guides/features/agent-workflows` - pass, Next dev Issues 0.
- `npm run verify:baseline` - pass. Baseline included typecheck, standards check, docs check, table sheet audit, static export hygiene, native dialog guard, UI i18n check, full test suite (137 files / 937 tests), cargo check, and production build.
- Installed local Playwright Firefox/WebKit browser binaries to run the requested cross-browser matrix.
- In-app browser smoke confirmed real SVG heights for primary fixtures; repeated same-tab fixture navigation produced noisy pending states, so the final cross-engine matrix used clean page loads per fixture.
- Journey diagrams were removed from the required F17 fixture set because they are not part of this request and showed unstable pending behavior in the current vendored Mermaid runtime. This can become a later explicit compatibility slice if users need journey diagrams.
- Pending: manual Tauri or real Safari/Chrome smoke by a human operator before marking F17 100%.

## 2026-05-21 (Agent)
**Status**: Development Completed
**Highlights**:
- **Initiated Feature F17**: Formulated requirements and spec sheets for a fully decoupled sandboxed Mermaid integration.
- **Architectural Design**: Planned and built an iframe-based micro-frontend architecture utilizing `postMessage` for dynamic height adjustment and syntax error delegation.
- **Vendoring Library**: Extracted compiled version of `mermaid.min.js` and its sourcemap from node_modules, copying them to the static `public/vendor/mermaid/` folder. This eliminates bundler overhead and ensures offline usability.
- **Stand-alone Sandbox Page**: Created `public/vendor/mermaid/index.html` which initializes Mermaid with matching emerald styles, listens for postMessage commands, renders SVGs safely, measures actual bounding-rect height, and posts the resize/error events back.
- **Reusable React Component**: Built `components/MermaidBlock.tsx` as a standard, modular interface. It mounts the iframe with strict sandbox settings (`sandbox="allow-scripts"`), isolating any generated diagrams from access to the parent's environment.
- **Seamless Integration**: Refactored `FeatureDocPanel.tsx` to use the new decoupled `MermaidBlock`, completely removing dynamic bundler imports from Next.js compiling.
- **Clean-up**: Relocated `mermaid` dependency to devDependencies for tracking purposes, ensuring production builds have zero runtime bundler bloat from Mermaid.
- **Plugin Guide Right Side Slide-over Panel**: Built `components/PluginGuidePanel.tsx` to slide open dynamically from the right side when users click the "Plugin Guide" button, matching the design of FeatureDocPanel.
- **Self-contained Slide-over Diagram Rendering**: The slide-over panel reads `/docs/engineering/plugin-guide.md` using Tauri's FS bridge, parses it via `ReactMarkdown`, and renders its built-in Mermaid architecture diagram natively and securely using our new decoupled sandboxed `MermaidBlock`.
- **Testing**: Added a dedicated `mermaidBlock.rendering.test.tsx` file verifying the sandbox attributes, message rendering, postMessage parsing, error display, and height updates. Run all 379 tests in the Project Manager workspace to full completion and got 100% green status.
