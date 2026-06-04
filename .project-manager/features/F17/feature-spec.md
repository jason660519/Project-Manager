# F17 Feature Spec - Decoupled Mermaid Integration

## Problem Statement

Project Manager publishes product documentation and renders feature-local Markdown documents. Those documents may contain Mermaid diagrams such as flowcharts, sequence diagrams, swimlane-style flowcharts, gantt charts, architecture diagrams, state diagrams, and class diagrams.

The user-facing problem is that external readers must not need to install Mermaid plugins, browser extensions, npm packages, or CLI tools before diagrams appear. A documentation page with a broken diagram is still a broken product page, even if the surrounding Markdown loads.

The engineering problem is that Mermaid is a large dependency with a broad parser/rendering surface. Loading it directly in React bloats the main bundle and rendering arbitrary user-authored diagram text in the app origin increases XSS and desktop-bridge risk. Project Manager must keep Mermaid decoupled from the main app while still giving users reliable diagrams.

The existing F17 iframe architecture is the right base. The 2026-06-04 slice hardens it for public docs, feature document panels, and cross-browser verification.

## User Stories

1. **External documentation reader** - As a potential user opening `/documentation`, I can see all approved public Mermaid diagrams without installing anything.
2. **Developer reviewing feature docs** - As a maintainer reading a feature README/spec in the dashboard, I can see diagrams inline without blank panels or iframe scrollbars.
3. **Offline/local developer** - As a user running Project Manager without internet access, diagrams still render from vendored static assets.
4. **Security-conscious desktop user** - As a Tauri user, diagram content cannot access app storage, cookies, Keychain, Tauri IPC, or local filesystem bridges.
5. **Documentation author** - As a writer, if Mermaid syntax is invalid, I get a visible error near the diagram rather than a silent failure.
6. **Cross-browser visitor** - As a Chrome, Edge, Firefox, or Safari user, the same page layout remains readable and diagrams are scaled within their content column.

## Acceptance Criteria

### AC-1: Sandboxed Iframe Environment
- [ ] Mermaid renders through `/public/vendor/mermaid/index.html`.
- [ ] Parent iframe keeps `sandbox="allow-scripts"` and does not add `allow-same-origin`.
- [ ] The iframe loads vendored `/public/vendor/mermaid/mermaid.min.js`, not a CDN URL.
- [ ] Mermaid is initialized with conservative security settings appropriate for untrusted Markdown.

### AC-2: PostMessage Communication Protocol
- [ ] The parent component sends the raw Mermaid markdown code to the iframe via `postMessage`.
- [ ] Messages include a per-render instance id so multiple diagrams do not resize each other.
- [ ] The iframe reports `resize` with measured dimensions for successful renders.
- [ ] The iframe reports `error` with a clean diagnostic for invalid syntax or unsupported diagrams.
- [ ] The parent ignores stale or unrelated iframe messages.

### AC-3: Reusable React `MermaidBlock` Component
- [ ] Create a React component `MermaidBlock` that renders the sandboxed iframe.
- [ ] Listen to resize message events and dynamically resize the iframe's height to prevent vertical scrollbars.
- [ ] Display an elegant diagnostic block if a syntax error is reported.
- [ ] Show a bounded loading/degraded state while the iframe is waiting or rendering.
- [ ] Keep horizontal overflow contained inside the diagram block.

### AC-4: Integration and Dependency Clean-Up
- [ ] Replace existing MermaidBlock inline logic in `FeatureDocPanel.tsx` with the new component.
- [ ] Remove `"mermaid"` dependency from `package.json`'s main `"dependencies"`, or transition it to `"devDependencies"` for local maintenance.
- [ ] Public `DocumentationView` and dashboard `FeatureDocPanel` both use the same `MermaidBlock`.

### AC-5: Diagram Type Coverage
- [ ] Add representative fixtures for flowchart, sequence, swimlane-style flowchart, gantt, state, class, and architecture diagrams.
- [ ] Automated tests cover parent behavior for success, failure, stale messages, and multiple instances.
- [ ] Browser smoke verifies real iframe rendering for representative diagrams.

### AC-6: Cross-browser and Tauri Verification
- [ ] Verify Chromium, Firefox, and WebKit via Playwright or equivalent local browser smoke.
- [ ] Manually verify Safari or WebKit-class rendering when available.
- [ ] Manually verify Tauri WebView rendering before marking the feature complete.
- [ ] Next.js dev Issues count is 0 on changed documentation routes.

## Recommended Architecture

Use a two-layer strategy:

1. **Primary runtime renderer**: vendored Mermaid rendered in a sandbox iframe. This supports feature-local Markdown and public docs with no user setup.
2. **Future static-doc optimization**: build-time SVG generation for public docs, with runtime iframe fallback when no generated asset exists.

This avoids a custom parser while keeping the main app bundle, app origin, and desktop bridge separated from Mermaid runtime behavior.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Mermaid syntax support differs by version | Keep vendored Mermaid version explicit and add fixtures for supported diagram families. |
| iframe height is wrong after font/layout settle | Measure after render and post dimensions; keep a bounded fallback height. |
| one diagram resizes another | Route messages by instance id and source window. |
| public docs show blank diagrams if Mermaid fails | Render visible error state and keep raw diagnostic available. |
| Tauri WKWebView behaves differently from Chrome | Include Tauri/WebKit smoke in completion gate. |
