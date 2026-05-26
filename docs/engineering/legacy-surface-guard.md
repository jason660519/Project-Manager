# Legacy Surface Guard

> Status: Active  
> Last updated: 2026-05-26  
> Primary files: `scripts/check-legacy-surfaces.mjs`, `scripts/check-branch-hygiene.mjs`, `package.json`

## Purpose

This guard prevents retired UI surfaces from re-entering Project Manager through stale local branches, old generated bundles, or incomplete merges.

Current protected regressions:

- The retired **Coding Editor** sidebar/page must not reappear.
- The current workspace entry is **xmux** at `/xmux`; `/cmux` is only a compatibility redirect.
- Project dashboard sheet tabs must keep drag-reorder support.

## Required Commands

Run these before handoff when touching navigation, dashboard sheets, workspace views, or release packaging:

```bash
npm run guard:legacy-surfaces
npm run branch:check
```

`npm run build` runs `guard:legacy-surfaces` automatically through `prebuild`.

## Branch Hygiene

`origin` should only expose approved active branches. For normal development, use:

- `main` for the shared stable baseline
- `codex/*` for Codex task branches

Deprecated branch names such as `coding-editor`, `monaco`, `legacy`, `old-dashboard`, or `old-sheets` are blocked by `npm run branch:check`.

If a teammate sees a retired UI surface while the source guard passes, first suspect a stale running app process or stale packaged desktop app. Confirm with:

```bash
git branch --show-current
git ls-remote --heads origin
npm run guard:legacy-surfaces
lsof -nP -iTCP:43187 -sTCP:LISTEN
ps -axo pid,ppid,lstart,comm,args | rg "project-manager|Project Manager|target/debug"
```

## Desktop Runtime Rule

The Tauri dev app must be restarted after navigation or route-level changes. Hot reload can update React components, but an already-running desktop shell may still show a stale bundle or route state until restarted.

When the source code says `xmux` but the app shows `Coding Editor` or a stale `cmux` route, stop the old desktop process and relaunch through the repo launcher:

```bash
./start_project_manager.sh
```

## Dashboard Sheet Rule

`app/project-progress-dashboard/_components/SheetTabs.tsx` must keep:

- `DASHBOARD_SHEET_ORDER_STORAGE_KEY`
- `normalizeSheetOrder`
- pointer drag handlers
- `GripVertical` drag affordance

Removing any of these is treated as a regression because it brings back the non-draggable sheet behavior.
