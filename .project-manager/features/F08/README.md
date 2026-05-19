# F08 — Zone 2: Top Command Bar

**Status**: done | **Progress**: 100%  
**Category**: Frontend/UI  
**Implementation**: `app/ui/TopBar.tsx`

## Summary

New fixed 48px bar inside the content area (not the sidebar). Positioned at the top of the right panel.

- **Left**: current view title in ALL CAPS (`text-[11px] font-semibold uppercase tracking-[0.18em]`)
- **Right**: search input + active runs badge

## Height Alignment

TopBar `h-12` (48px) matches the sidebar logo row `h-12` so the horizontal border at `border-b border-stone-200/15` aligns across both columns. This was an explicit fix — do not change either height independently.

## Design Reference

Hermes Agent top command bar. Matches style: tight uppercase label, right-anchored controls.

## Related Files

- `app/ui/AppShell.tsx` — renders TopBar inside the right panel flex column
- `app/ui/Sidebar.tsx` — logo row uses same `h-12` height for border alignment
