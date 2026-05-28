# VLM Arena Image Persistence Report

> Date: 2026-05-29
> Scope: `Keys` module, `VLM Arena` image-to-image evaluation sheet

## Problem

Before this change, VLM Arena image-to-image rows, generated 2D/3D images, run history, and in-flight provider promises were owned by `VlmArenaSheet` component state. Navigating away from the sheet unmounted the component, so completed images disappeared and unfinished rows lost their write-back target.

## Changes

- Added a module-level VLM image-to-image store in `VlmImageToImageEvaluation.ts`.
- Persisted row state and history to `localStorage` under `projectManager:keys-vlm-image-to-image:v1`.
- Added an active task registry so page navigation does not cancel or orphan ongoing model evaluations.
- Rewired `VlmArenaSheet` to subscribe to the persisted store instead of owning rows/history locally.
- Added automatic resume for persisted `running` rows when the sheet mounts again with an available input image.
- Preserved completed generated image URLs, result text, status, HTTP status, E2E time, last run timestamp, and per-model history.
- Added a running elapsed-time label in the table status cell.

## Runtime Behavior

| Scenario | Expected Result |
| --- | --- |
| Run All then navigate away | Active model jobs continue in the module-level registry. |
| Return to VLM Arena sheet | Rows rehydrate from the persisted store and subscribe to continuing updates. |
| Some rows already completed | Generated 2D/3D images remain visible. |
| Some rows still running | Status remains `running` and elapsed seconds continue from `runStartedAtMs`. |
| Full browser refresh with running rows | The persisted `running` rows are dispatched again once the input image is available. |
| Provider failure | Row persists as `failed` with message, HTTP status if available, and history entry. |

## Tests

Command:

```bash
npm test -- --run __tests__/keys.context-persistence.test.tsx __tests__/keys.llm-arena-model-selection.test.tsx __tests__/keys.vlm-image-to-image-evaluation.test.ts
```

Result:

```text
Test Files  3 passed (3)
Tests  16 passed (16)
```

Additional validation:

```bash
npm run typecheck
```

Result: passed.
