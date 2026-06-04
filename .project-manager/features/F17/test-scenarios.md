# F17 Test Scenarios

## Purpose

Map real user paths and implementation risks into unit, integration, E2E, and manual verification candidates for Mermaid rendering. F17 is user-facing even though the implementation is infrastructure: a blank diagram on a public product page blocks understanding.

## Scenario Matrix

| Scenario ID | User Path | Risk | Unit / Integration Coverage | E2E Coverage Candidate | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| F17-S01 | External visitor opens `/documentation/guides/solutions/live-agent-observability` with a sequence diagram | Diagram is blank unless user installs Mermaid tooling | Browser fixture for sequence diagram; static vendor asset check | Chromium/Firefox/WebKit docs smoke | Candidate | 2026-06-04 kickoff |
| F17-S02 | External visitor opens a solution page with a flowchart | SVG overflows or clips the product explanation | MermaidBlock resize unit test; flowchart fixture | Responsive browser smoke at desktop and narrow widths | Candidate | Public docs |
| F17-S03 | Maintainer opens Project Dashboard feature document panel containing Mermaid | Feature panel shows code fence instead of diagram | FeatureDocPanel markdown component test candidate | Dashboard manual smoke | Candidate | Dashboard workflow |
| F17-S04 | Documentation author writes invalid Mermaid syntax | Page silently fails or renders a blank iframe | Error postMessage test | Broken fixture browser smoke | Partially covered | Existing unit test |
| F17-S05 | Page contains three Mermaid diagrams | One iframe resize/error message affects another diagram | Multiple-instance and stale-id unit tests | Fixture page with three diagrams | Candidate | Protocol risk |
| F17-S06 | User changes selected document while iframe is already ready | Old code remains rendered | Code-change postMessage test | Feature doc panel switch smoke | Candidate | React lifecycle |
| F17-S07 | Offline/local user opens documentation | CDN request fails and diagrams disappear | Static scan blocks `https://` Mermaid script URL | Network-disabled browser smoke candidate | Candidate | Offline requirement |
| F17-S08 | Tauri desktop user opens untrusted project docs | Diagram content reaches parent app origin or Tauri bridge | iframe sandbox attribute test | Tauri manual probe | Candidate | Security boundary |
| F17-S09 | Public docs include gantt, state, class, swimlane, or architecture diagrams | Less common diagram families regress unnoticed | Fixture inventory and smoke | Browser fixture matrix | Candidate | Diagram coverage |
| F17-S10 | Browser lacks a Mermaid feature or architecture-beta changes syntax | Unsupported diagram breaks whole page | Error fallback test | Architecture fixture smoke | Candidate | Compatibility risk |

## Unit Test Backlog

- Parent renders sandboxed iframe with no `allow-same-origin`.
- Parent sends render after iframe ready.
- Parent re-sends render when `code` changes.
- Parent ignores messages for stale ids or unrelated iframe windows.
- Parent renders syntax error diagnostics.
- Parent keeps bounded height before resize.

## E2E Candidate Backlog

- Documentation fixture page with all supported diagram families.
- Browser smoke across Chromium, Firefox, and WebKit.
- Tauri smoke for `/documentation` and dashboard feature doc panel.
- Network-disabled smoke to prove no CDN dependency.

## Conversion Rule

When debugging reveals a new real user path, append a scenario row before or alongside the fix, then map it to focused tests or manual verification.
