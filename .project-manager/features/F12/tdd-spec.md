# F12 TDD Spec — Skills Management Page

## Test Suites

### Suite A — Pure Utility Functions (`skills.utils.test.ts`)

| # | Test | Expected |
|---|---|---|
| A1 | `parseFrontmatter` — full YAML block | Returns name, description, version, tags, body |
| A2 | `parseFrontmatter` — no frontmatter | Returns empty meta, raw string as body |
| A3 | `parseFrontmatter` — tags in metadata.hermes.tags | Parses tags correctly |
| A4 | `parseFrontmatter` — quoted description | Strips quotes from values |
| A5 | `parseCategorySlug` — 3-part path `cat/slug/SKILL.md` | category=cat, slug=slug |
| A6 | `parseCategorySlug` — 2-part path `cat/skill.md` | category=cat, slug=skill |
| A7 | `parseCategorySlug` — 1-part path `skill.md` | category=uncategorized, slug=skill |
| A8 | `slugify` — spaces and uppercase | Converts to kebab-case |
| A9 | `slugify` — special characters | Replaces with `-`, trims edges |
| A10 | `slugify` — empty string | Returns `'skill'` fallback |
| A11 | `buildSkillContent` — standard form | Has valid YAML frontmatter + body |
| A12 | `buildSkillContent` — tags serialized | Tags written as `[tag1, tag2]` |

### Suite B — Delete Flow (`SkillsView.delete.test.tsx`)

| # | Test | Expected |
|---|---|---|
| B1 | Trash button click → delete modal opens | Modal visible with skill name |
| B2 | Cancel button → modal closes | Modal unmounted, no bridge call |
| B3 | Confirm delete → `skillUninstall` called with correct args | Bridge invoked once |
| B4 | Successful delete → modal closes, list reloads | `loadSkills` called, modal gone |
| B5 | **Failed delete → error shown INSIDE modal** | Error text visible in modal |
| B6 | Failed delete → modal stays open | Delete modal still in DOM |
| B7 | `skillsDir` empty → confirm no-op, no bridge call | Guard respected |

## Bug Regression Tests

### B5 / B6 — F12-BUG-001 regression

```typescript
it('shows error message inside the delete modal when deletion fails', async () => {
  skillUninstallMock.mockRejectedValueOnce(new Error('Permission denied'));

  // open delete modal
  await userEvent.click(screen.getByTitle('Delete'));
  // confirm delete
  await userEvent.click(screen.getByRole('button', { name: /^Delete$/ }));

  // error must be visible INSIDE the modal, not in a hidden component
  expect(await screen.findByText(/Permission denied/)).toBeInTheDocument();
  // modal must remain open
  expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
});
```

## Coverage Target

| Category | Target |
|---|---|
| Pure utility functions | 100% |
| Delete modal flow (happy path) | 100% |
| Delete modal flow (error path) | 100% |
| Guard conditions (empty skillsDir) | 100% |
