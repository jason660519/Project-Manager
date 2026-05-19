# F07 — Zone 1: Sidebar Redesign

**Status**: done | **Progress**: 100%  
**Category**: Frontend/UI  
**Implementation**: `app/ui/Sidebar.tsx`

## Summary

Expanded sidebar from 68px icon-only to 180px with text labels. Organized into 4 nav groups:

| Group | Items |
|---|---|
| WORKSPACE | Projects, Dashboard, Files |
| EXECUTION | Engineers, Plugins, Channels, Cron Jobs |
| OBSERVE | Sessions, Logs |
| SYSTEM | Keys, Shortcuts, Settings, Docs |

Bottom system status block: bridge status indicator + active run count + GUARDED badge.

## Design Reference

Hermes Agent sidebar layout (`.project-manager/hermes/`). Kept the same grouping logic and bottom-anchored system block pattern.

## Related Files

- `app/ui/AppShell.tsx` — sidebar is positioned in a `lg:grid-cols-[180px_minmax(0,1fr)]` grid
- `app/globals.css` — `--pm-sidebar` CSS variable
