# F03 — TDD Spec: Live Run Inspector

## Test Suites

### Suite A: Component Rendering (`RunsView.test.tsx`)

**Type**: Vitest + React Testing Library (jsdom)  
**Target**: `app/ui/views/RunsView.tsx` — `RunsView` component  
**Setup**: Wrap in `<I18nProvider>` with mock `activeRuns`, `runHistory`, `onKillRun` props

| # | Test Name | Assertions |
|---|-----------|------------|
| A1 | renders active runs list | For each active run: renders feature name, PID, command, duration badge. Has Kill and Log buttons. Pulse icon shown. |
| A2 | renders run history | For each completed run: renders feature name, exit code, success/failure icon, duration, completion time. |
| A3 | renders empty history state | When `runHistory` is empty: shows center-aligned empty state with Terminal icon, "No runs yet" text and hint. Active runs section still renders. |
| A4 | toggles log view on active run | Click "View Log" shows log content. Click "Hide Log" hides it. "Waiting for output…" shown when logs array empty. |
| A5 | toggles log view on history item | Click history row expands logs. Click again collapses. Only shows when logs.length > 0. |
| A6 | success icon vs failure icon | Run with `success: true` shows CheckCircle2 (emerald). Run with `success: false` shows XCircle (red). |

### Suite B: Kill Confirmation (`RunsView.test.tsx`)

**Type**: Vitest + React Testing Library (jsdom)  
**Target**: `app/ui/views/RunsView.tsx` — kill confirmation behavior

| # | Test Name | Assertions |
|---|-----------|------------|
| B1 | clicking Kill shows confirmation | Click "Kill" button → confirmation dialog visible with feature name and PID. "Confirm" and "Cancel" buttons shown. Original Kill button hidden. |
| B2 | confirming kill fires callback | Click "Confirm" → `onKillRun` called with correct PID. Dialog is removed after. |
| B3 | cancelling kill hides dialog | Click "Cancel" → `onKillRun` not called. Dialog removed. Kill button visible again. |

### Suite C: i18n Integration (`i18n types`)

**Type**: TypeScript compile check + key presence  
**Target**: `lib/i18n/types.ts` + locale files

| # | Test Name | Assertions |
|---|-----------|------------|
| C1 | runs section exists in types.ts | `Translations` interface has `runs` object with all required keys |
| C2 | all 4 locales have runs keys | `en.ts`, `zh-hant.ts`, `zh.ts`, `ja.ts` export translations with matching `runs` keys |
| C3 | hardcoded strings removed from RunsView | All JSX text nodes use `t.runs.*` (verified by typecheck — no compile-time reference to raw strings that should be localized) |

## Coverage Targets

| Area | Target |
|------|--------|
| Kill confirmation flow | 100% |
| Empty/edge states | 100% |
| Active run + history rendering | 100% |
| i18n key contract | 100% |
| Component render paths | 90% |
| **Overall** | **85%** |

## Test Infrastructure

```ts
// __tests__/runs/RunsView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../../../lib/i18n';
import { RunsView } from '../../../app/ui/views/RunsView';
```

## Mock Data

```ts
const mockActiveRuns = [
  {
    pid: 1001,
    featureId: 'F03',
    featureName: 'Live Run Inspector',
    command: 'cursor',
    args: ['--task', 'F03'],
    startedAt: Date.now() - 35000,
    logs: ['Starting...', 'Processing...'],
    phase: 'running' as const,
  },
];

const mockCompletedRuns = [
  {
    pid: 9001,
    featureId: 'F12',
    featureName: 'Skills Page',
    command: 'codex',
    args: ['--task', 'F12'],
    startedAt: Date.now() - 120000,
    completedAt: Date.now() - 60000,
    exitCode: 0,
    success: true,
    logs: ['Done.'],
  },
  {
    pid: 9002,
    featureId: 'F11',
    featureName: 'i18n Guide',
    command: 'cursor',
    args: ['--task', 'F11'],
    startedAt: Date.now() - 300000,
    completedAt: Date.now() - 180000,
    exitCode: 1,
    success: false,
    logs: ['Error: build failed'],
  },
];
```
