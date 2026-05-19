# F12 Dev Log — Skills Management Page

## Session 1 — Initial Implementation

**Date**: 2026-05-19  
**Status**: Green ✅

---

### Summary

Built the Skills Management page (F12) end-to-end, then discovered and fixed a silent delete bug via TDD.

---

### Changes Delivered

#### Infrastructure
- `lib/types/index.ts` — added `'skills'` to `ViewId` union (also fixed pre-existing `'keyboard-shortcuts'` gap)
- `lib/i18n/{types,en,zh-hant,zh,ja}.ts` — added `skills` nav label in all 4 locales
- `app/skills/page.tsx` — new Next.js route mounting `SkillsView`
- `app/ui/Sidebar.tsx` — added Skills entry under Execution group (Sparkles icon)
- `app/ui/TopBar.tsx` — added `skills` label to `VIEW_LABELS`
- `app/ui/MainClient.tsx` — wired `SkillsView` render for `currentView === 'skills'`

#### Rust / Bridge
- `src-tauri/src/lib.rs` — added `skill_save` Tauri command with security path validation
- `lib/bridge/index.ts` — added `skillSave` typed wrapper

#### Skills View
- `lib/skills/utils.ts` — pure utility functions extracted for unit-testability:
  `parseFrontmatter`, `parseCategorySlug`, `slugify`, `buildSkillContent`
- `app/ui/views/SkillsView.tsx` — full Skills page with:
  - Left category tree + right card grid layout
  - Create / Edit skill modal (SKILL.md frontmatter editor + markdown body)
  - Delete confirmation modal
  - Detail panel with rendered markdown
  - Skill file open in Finder (`openPath`)

---

### Bug Fixed: F12-BUG-001 — Silent Delete Failure

**Root cause**: `handleDelete` catch block called `setSaveError()` which is owned by
`SkillModal`. `DeleteConfirmModal` had no `error` prop, so all delete errors were silently
swallowed.

**Fix**:
1. Added dedicated `deleteError` state (`useState<string | null>(null)`)
2. `handleDelete` catch block now calls `setDeleteError(...)` instead of `setSaveError`
3. `DeleteConfirmModal` received a new `error: string | null` prop
4. Error rendered inside the modal with `role="alert"` (visible to user and accessible)
5. `openDeleteConfirm()` helper clears `deleteError` on open; Cancel also clears it

---

### Test Suites

| Suite | File | Tests | Status |
|---|---|---|---|
| A — Pure utilities | `__tests__/skills.utils.test.ts` | 25 | ✅ All pass |
| B — Delete flow | `__tests__/SkillsView.delete.test.tsx` | 7 | ✅ All pass |

**Total new tests**: 32  
**Overall suite**: 255 / 255 passing

---

### Selector Lesson (for future test authors)

When a modal opens over a card that contains the same text (e.g. skill name), use
`within(screen.getByTestId('delete-confirm-modal'))` to scope assertions and clicks
to the modal element. Otherwise `getByText` / `getByRole` will find multiple elements
and throw. The component exposes `data-testid="delete-confirm-modal"` specifically for
this pattern.

---

### Verification Baseline

```
npm test          → 31 files, 255 tests, all pass
npm run typecheck → ✓ Types generated successfully
cargo check       → Finished dev profile
```

## Session 2 — Final Completion Pass

**Date**: 2026-05-20  
**Status**: Complete

### Summary

Rechecked F12 against the feature and TDD specs. The utility layer and delete regression
coverage are present, and the Skills UI covers browse, search, detail, create, edit, and
delete flows. Marked F12 complete in project config.

### Verification

- `npm test -- --run` — required final gate
- `npm run typecheck` — required final gate
