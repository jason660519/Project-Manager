# F27 TDD Spec: xmux Coding Tool Sidebar Entry

## Test Strategy

This feature covers navigation, adapter registry, documentation plumbing, and a minimal interactive xmux console. Use focused unit tests, typecheck/build gates, and browser checks for the interactive controls.

## Unit Tests

### Adapter Registry

- `listAdapters()` includes a built-in agent CLI with id `xmux`.
- The `xmux` adapter uses command `cmux`.
- The `xmux` adapter has `targetKind: agent-cli`.
- A default config does not expose both `cmux` and `xmux`.
- A legacy configured adapter with id `cmux` is normalized or preserved in a way that remains dispatchable as the xmux target.
- `createRuntimeAdapter(config, 'xmux')` returns an agent runtime adapter.

### Capability Registry

- `BUILT_IN_ADAPTER_SUPPORTS.xmux` includes the full agent capability set.
- Legacy `cmux` capability support remains available only if needed for migration/backward compatibility.

## UI/Route Tests

- Rendering `MainClient currentView="xmux"` shows the xmux view.
- The xmux view includes a workspace sidebar and terminal/browser split-pane topology.
- The xmux view explains the Globe, Bell, and Grid toolbar controls and their shortcuts.
- Clicking the Globe control hides and restores the browser pane.
- Clicking the Bell control opens the notification rail.
- Clicking the Grid control switches the workspace aria state from vertical to horizontal split.
- Terminal panes expose command inputs for allowlisted commands.
- Sidebar translations contain `xmux`.
- TopBar can label `xmux`.
- `/xmux` route points to `MainClient currentView="xmux"`.

## Documentation Tests

- `docs/guides/features/xmux.md` has public frontmatter.
- Documentation site sync includes `features/xmux` in the public manifest.
- The doc separates current Project Manager behavior from future deep integration work.

## Manual Verification

1. Run the dev server.
2. Open `/xmux`.
3. Confirm sidebar active state is on `xmux`.
4. Confirm the main surface resembles the intended interop interface: workspace list, active workspace header, terminal tabs, browser/terminal split, and bottom terminal pane.
5. Confirm right-top toolbar controls show browser, notification, and split-layout semantics.
6. Confirm Globe toggles the browser pane.
7. Confirm Bell opens the notification rail.
8. Confirm Grid changes vertical/horizontal split layout.
9. Confirm terminal input can run `cmux --version`.
10. Confirm browser URL input can navigate to a local Project Manager route.
11. Confirm text does not overflow at desktop and narrow widths.
12. Confirm `/project-progress-dashboard` still renders and F27 appears in the Project Manager dashboard after config reload.
13. Confirm dispatch target selector shows `xmux` instead of `Cmux CLI`.

## Required Commands

```bash
npm test -- --run __tests__/xmux.registry.test.tsx
npm run docs:site:sync
npm run docs:site:check
npm run docs:check
npm run typecheck
```

Run `npm run build` before final handoff unless a faster targeted verification is explicitly accepted for the turn.
