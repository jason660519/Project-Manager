# F17: Decoupled Mermaid Integration

## Summary

F17 owns the zero-configuration Mermaid rendering path for Project Manager documentation and feature document panels. The current architecture keeps Mermaid out of the main Next.js bundle by rendering diagrams inside a static sandbox iframe under `/public/vendor/mermaid/`.

The 2026-06-04 hardening slice focuses on making that approach reliable for external users and future engineers:

1. Public documentation pages must render Mermaid diagrams without asking visitors to install browser plugins, Mermaid CLI tools, or local dependencies.
2. Feature document panels must keep rendering user-authored Mermaid blocks safely in browser mode and Tauri mode.
3. Cross-browser behavior must be verified for Chromium, Firefox, WebKit/Safari-class engines, and Tauri WebView.
4. The renderer must handle common Mermaid diagram families such as flowcharts, sequence diagrams, swimlane-style flowcharts, gantt charts, state/class diagrams, and architecture diagrams.
5. Failures must degrade visibly with a useful diagnostic instead of a blank page or silent console-only error.

## Current State

- `components/MermaidBlock.tsx` renders a sandboxed iframe with `sandbox="allow-scripts"`.
- `public/vendor/mermaid/index.html` loads `public/vendor/mermaid/mermaid.min.js` and renders on `postMessage`.
- `DocumentationView` and `FeatureDocPanel` route Markdown `mermaid` code fences through `MermaidBlock`.
- `__tests__/mermaidBlock.rendering.test.tsx` covers the parent-side iframe and message flow.

## Scope

- Harden the parent/iframe message protocol.
- Add browser-renderable fixtures for the diagram types users are likely to include in public product documentation.
- Add focused automated tests for ready, resize, error, stale message, and multiple-instance behavior.
- Add a manual verification matrix for Chrome/Edge, Firefox, Safari/WebKit, and Tauri.
- Keep Mermaid vendored as a static UI plugin under `/public/vendor/mermaid/`.

## Non-goals

- Replacing Mermaid with a custom diagram parser.
- Requiring users to install Mermaid CLI, browser extensions, or local npm packages.
- Moving user-authored Markdown rendering into the Tauri Rust layer.
- Shipping a CDN-only Mermaid dependency.

## Artifacts

- Feature spec: `.project-manager/features/F17/feature-spec.md`
- TDD spec: `.project-manager/features/F17/tdd-spec.md`
- Test scenarios: `.project-manager/features/F17/test-scenarios.md`
- Dev log: `.project-manager/features/F17/dev-log.md`
