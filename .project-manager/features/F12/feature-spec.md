# F12 Feature Spec — Skills Management Page

## Problem Statement

Engineers need a centralized place to manage the AI agent skills (SKILL.md files) used
in their projects. Currently these files are manually edited on disk with no UI.

## User Stories

1. **Browse** — As an Engineer, I can see all skills grouped by category so I know what
   capabilities are available for dispatch.
2. **Search** — As an Engineer, I can search by name / description / tags to find
   relevant skills quickly.
3. **Detail** — As an Engineer, I can click a skill card to read the full SKILL.md
   content in a side panel.
4. **Create** — As an Engineer, I can create a new skill by filling in a modal form
   (name, category, description, tags, version, body).
5. **Edit** — As an Engineer, I can edit an existing skill; changes persist to disk.
6. **Delete** — As an Engineer, I can delete a skill with a confirmation step; the
   card disappears and the file is removed from disk.

## Acceptance Criteria

### AC-1: Browse
- [ ] Left category tree lists all discovered categories with counts
- [ ] "All Skills" entry shows total count
- [ ] Clicking a category filters the card grid

### AC-2: Search
- [ ] Real-time filter across name, description, tags, category
- [ ] Empty state shown when no results

### AC-3: Detail Panel
- [ ] Click card → slide-over panel opens from right
- [ ] Full markdown rendered with `pm-prose` styles
- [ ] Panel closes on Escape or backdrop click

### AC-4: Create
- [ ] "New Skill" button opens modal
- [ ] Required: Name, Category
- [ ] Path preview shown: `.agents/skills/{cat}/{slug}/SKILL.md`
- [ ] On save: file written to disk, list reloaded

### AC-5: Edit
- [ ] Pencil button on card / detail panel opens modal pre-filled
- [ ] On save: new file written, old file removed if path changed

### AC-6: Delete ← **BUG FOUND**
- [ ] Trash button opens delete confirmation modal
- [ ] Confirmation shows skill name and relPath
- [ ] On confirm: file deleted from disk, card removed, modal closed
- [ ] **If deletion fails: error message shown inside modal** ← MISSING

## Known Bugs (F12-BUG-001)

**Delete silently fails** — `handleDelete` catch block writes the error into `saveError`
state, which only renders inside `SkillModal`. `DeleteConfirmModal` has no error prop and
no way to surface failure feedback to the user.

**Fix**: Introduce a dedicated `deleteError` state; pass it to `DeleteConfirmModal`.
