# F19 — Free-form Notes

## 2026-05-24

- First draft of the sheet shipped with a card grid. User pushed back: too low density, status indicator and action button were visually conflated.
- Second draft moved to a 5-column table and renamed the disconnect verb to `Revoke`. This is the version captured in `feature-spec.md`.
- Built-in connector icons are emoji because we don't ship brand SVGs in the repo. When the design system gets a brand-icon set, swap them out in `BUILTIN_CONNECTORS` — the keys stay the same.

## Open Questions

- Should the `pm:connect:state` `localStorage` blob be namespaced per project (currently it's global to the desktop install)? Comes up the moment we have real tokens.
- If two engineers share a machine through the same OS user, the `connected` map is shared. Acceptable for the boolean prototype; not acceptable post-OAuth.
- Custom connectors today don't have a category picker. Should they? Skipped to keep the dialog simple.
