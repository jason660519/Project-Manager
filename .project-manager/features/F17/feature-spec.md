# F17 Feature Spec — Decoupled Mermaid Integration

## Problem Statement

Currently, Mermaid is loaded dynamically using `import('mermaid')` in React. This still pulls Mermaid and its large dependency tree (including d3 and dagre) into the Next.js bundle, slowing down build and load times. Furthermore, rendering arbitrary user-provided Mermaid diagrams poses an XSS security risk in a desktop application context where a successful script injection could access Tauri system-level commands, Keychain secrets, or localized files.

## User Stories

1. **Sandboxed Diagram Rendering** — As a User, I can view documents with markdown-rendered Mermaid diagrams safely without exposing my system, Tauri commands, or Keychain secrets to potential diagram script injection.
2. **Dynamic Height Resizing** — As a User, I can view Mermaid diagrams inline inside the Feature Document Panel without scrollbars, as the diagram iframe automatically adjusts its height dynamically to match the SVG size.
3. **Offline Diagram Rendering** — As an Offline Developer, I can view my project specs' Mermaid diagrams without requiring an active internet connection.
4. **Syntax Error Diagnosis** — As a Developer, if my Mermaid syntax has an error, I can see a clear error box showing the specific syntax issue.

## Acceptance Criteria

### AC-1: Sandboxed Iframe Environment
- [ ] Create a static sandboxed iframe HTML file at `/public/vendor/mermaid/index.html`.
- [ ] Sandboxed iframe has `sandbox="allow-scripts"` and doesn't run with elevated privileges.
- [ ] It loads a local pre-compiled copy of `mermaid.min.js`.

### AC-2: PostMessage Communication Protocol
- [ ] The parent component sends the raw Mermaid markdown code to the iframe via `postMessage`.
- [ ] The iframe receives the message, registers syntax errors or renders the flowchart, and reports either the height (in pixels) of the rendered flowchart or the detailed syntax error back to the parent.

### AC-3: Reusable React `MermaidBlock` Component
- [ ] Create a React component `MermaidBlock` that renders the sandboxed iframe.
- [ ] Listen to resize message events and dynamically resize the iframe's height to prevent vertical scrollbars.
- [ ] Display an elegant diagnostic block if a syntax error is reported.

### AC-4: Integration and Dependency Clean-Up
- [ ] Replace existing MermaidBlock inline logic in `FeatureDocPanel.tsx` with the new component.
- [ ] Remove `"mermaid"` dependency from `package.json`'s main `"dependencies"`, or transition it to `"devDependencies"` for local maintenance.
