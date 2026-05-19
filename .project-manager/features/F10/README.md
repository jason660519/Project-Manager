# F10 — Zone 4: AppShell Canvas & Layout Grid

**Status**: done | **Progress**: 100%  
**Category**: Frontend/UI  
**Implementation**: `app/ui/AppShell.tsx`

## Summary

Updated the AppShell layout grid to support the 4-zone redesign:

- Grid: `lg:grid-cols-[180px_minmax(0,1fr)]` — sidebar (180px) + content area (fluid)
- Background layers: `pm-bg-noise` (grid pattern) + `pm-bg-glow` (radial gradient, theme-aware)
- Content area: `flex-col` with TopBar at top, scrollable canvas below (`flex-1 overflow-y-auto`)
- Outer padding reduced from `px-7` → `px-5 py-5`

## CSS Variables (theme-aware)

Defined in `app/globals.css`:

| Variable | Role |
|---|---|
| `--pm-bg` | Page background |
| `--pm-sidebar` | Sidebar background (slightly darker) |
| `--pm-glow` | Radial glow accent color |
| `--pm-active-bg` | Active nav item background |
| `--pm-accent` | Primary accent color |

Each theme (`data-theme="midnight"`, `"ember"`, `"mono"`) overrides these variables.

## Related Files

- `app/globals.css` — CSS variable definitions + noise/glow utility classes
- `app/ui/Sidebar.tsx` — occupies the 180px column
- `app/ui/TopBar.tsx` — occupies the top 48px of the content column
