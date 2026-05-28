# F36 Dev Log - Performance Baseline, Route Splitting & xmux Smoothness

## 2026-05-28 - Kickoff and baseline

### Context

User requested a measured Project Manager code slimming and UI smoothness pass, but asked to first register the work in Project Dashboard > Development sheet and create feature artifacts for future engineers.

### Baseline Observations

- `main` build baseline completed with Next.js 16.2.6 / Turbopack.
- Build timing observed before implementation:
  - Compile: about 7.8s
  - TypeScript: about 6.6s
  - Static pages: 69 pages in about 1.0s
- `.next/static/chunks` total observed around 2.5 MB.
- Largest observed static client chunk was about 1.57 MB.
- `MainClient` statically imports many route views, making route-level bundle splitting the first low-risk target.

### Planned Work

1. Add F36 to `.project-manager/config.json`.
2. Create README, feature spec, TDD spec, test scenarios, and dev log.
3. Split heavy inactive route views from `MainClient` with `next/dynamic`.
4. Add focused route/lazy-loading tests.
5. Re-run typecheck, focused tests, and production build.
6. Record bundle/build deltas here.

### Design Decision

Use route-level lazy loading before broad dead-code cleanup. Dead-code tools can reduce maintenance cost, but the initial performance signal points to initial client bundle and runtime interaction hotspots, especially `MainClient` imports and xmux browser/resize behavior.

### Verification Log

- F36 metadata/docs verification - pass (`jq` found F36; all five feature artifact files are non-empty).
- `npm run test -- --run __tests__/MainClient.lazy-routes.test.tsx __tests__/MainClient.sync.test.tsx __tests__/MainClient.real-checkbox.test.tsx` - pass, 3 files / 16 tests.
- `npm run typecheck` - pass.
- `npm run docs:check` - pass.
- `NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next build` - pass.
- Browser smoke on existing local Next server (`127.0.0.1:43187`) - pass for:
  - `/project-progress-dashboard`
  - `/xmux`
  - `/keys/llm-arena`
  - `/documentation/guides/features/xmux`

### Implemented

- Added F36 to `.project-manager/config.json` so Project Dashboard > Development can surface this work and artifact links.
- Added README, feature spec, TDD spec, test scenarios, and dev log under `.project-manager/features/F36/`.
- Replaced inactive-route static imports in `app/ui/MainClient.tsx` with `next/dynamic` named-export imports.
- Kept the dashboard and dashboard empty-state project selector static, because those are the default route path and startup fallback.
- Added a compact `RouteViewLoading` placeholder for lazy route chunks.
- Added `__tests__/MainClient.lazy-routes.test.tsx` to verify loading fallback and prop pass-through for xmux, Keys deep links, Documentation slugs, and AI Assistants sheet selection.

### Build Delta

| Metric | Before | After | Notes |
| --- | ---: | ---: | --- |
| Largest static client chunk | ~1.57 MB | ~401 KB | Main initial route pressure reduced substantially. |
| xmux chunk | bundled into largest chunk | ~224 KB | Xmux now loads as its own route chunk. |
| Total `.next/static/chunks` JS | ~2.42 MB | ~2.46 MB | Slightly higher from chunk split overhead. |
| Compile time | ~7.8s | ~7.4s | Same order of magnitude; not the primary target. |
| TypeScript time during build | ~6.6s | ~7.6s | Same order of magnitude. |

### Current Progress

- F36 progress set to 60%.
- Complete: feature metadata/docs, first route-level lazy loading slice, focused tests, typecheck, docs check, and production build comparison.
- Complete: browser-mode route smoke for dashboard, xmux, keys, and documentation.
- Remaining: Tauri/manual xmux resize/bounds-sync profiling, optional debounce or visibility-window optimization if runtime evidence supports it.
