# F36 Test Scenarios

## Real User Paths

### F36-S01: Cold-start dashboard

1. User opens Project Manager at `/project-progress-dashboard`.
2. User waits for the dashboard shell.
3. User scans Development sheet and project metrics.

Expected: dashboard renders under the existing AppShell, active navigation is correct, and unrelated route views are not required for the first dashboard render.

### F36-S02: Open xmux after dashboard

1. User starts on dashboard.
2. User clicks xmux in the sidebar.
3. User waits for xmux workspace to load.

Expected: a compact loading state may appear briefly, then xmux renders with workspace fallback or active selected-project workspace. No blank shell or route crash occurs.

### F36-S03: Resize xmux pane

1. User opens `/xmux`.
2. User creates or uses a split with browser/terminal tabs.
3. User drags a split divider.

Expected: resize remains smooth, native browser painting is suspended only during drag, and painting resumes after mouseup, blur, or visibility change.

### F36-S04: Open Keys LLM Arena deep link

1. User opens `/keys/llm-arena`.
2. User expects the Keys page to load the LLM Arena sheet directly.

Expected: route-level dynamic import preserves the selected sheet prop and renders the LLM Arena surface.

### F36-S05: Open Documentation deep link

1. User opens `/documentation/guides/features/xmux`.
2. User expects the docs browser to select the xmux guide.

Expected: documentation manifest and slug are passed through the lazy boundary and the xmux guide content is selected.

### F36-S06: Open AI Assistants sheet

1. User opens `/ai_assistants/engineers`.
2. User expects AI Assistants to open with the requested sheet.

Expected: assistant sheet selection survives route splitting.

### F36-S07: Utility routes still work

1. User opens Settings, Logs, Sessions, Cron Jobs, Engineers, Channels, Features, and Company Standards routes.
2. User checks the first visible panel on each route.

Expected: each route renders its view with existing empty/loading/error states intact.

## Coverage Map

| Scenario | Unit | Integration | Manual |
| --- | --- | --- | --- |
| F36-S01 | MainClient dashboard render | Dashboard route smoke | F36-M01 |
| F36-S02 | dynamic Xmux render | Sidebar route switch | F36-M02 |
| F36-S03 | resize cleanup guard | BrowserSlot/registry tests | F36-M03 |
| F36-S04 | Keys prop pass-through | Keys deep link route | F36-M04 |
| F36-S05 | Documentation prop pass-through | Docs deep link route | F36-M05 |
| F36-S06 | assistantSheet prop pass-through | AI Assistants deep link route | F36-M06 |
| F36-S07 | utility view render smoke | Route smoke matrix | F36-M07 |

## Test Data

- Use existing sample project config from Project Manager.
- Use current generated documentation public manifest.
- Do not fabricate provider keys or execution success.
- For browser/native-only xmux checks, mark unsupported mode explicitly rather than treating browser fallback as native success.
