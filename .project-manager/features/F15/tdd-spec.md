# F15 TDD Spec — GitHub Issues Dashboard Tab

**Feature**: F15  
**Testing scope**: unit (column rendering, issue cache, filter logic) + integration (sync flow)

---

## Test Plan

### T1 — IssuesTab renders sync button when no cached issues

```typescript
// __tests__/IssuesTab.test.tsx
test('shows sync button when cache is empty', () => {
  render(<IssuesTab projectId="test" />);
  expect(screen.getByText('Sync Issues from GitHub')).toBeInTheDocument();
});
```

### T2 — Cached issues render as rows

```typescript
test('renders issue rows from cache', () => {
  const issues: GithubIssue[] = [
    { id: 1, number: 42, title: 'Fix login', state: 'open', labels: ['bug'], createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-10T00:00:00Z', url: 'https://github.com/owner/repo/issues/42', user: 'jason' },
  ];
  localStorage.setItem('pm-issues-test', JSON.stringify({ issues, syncedAt: Date.now() }));
  render(<IssuesTab projectId="test" />);
  expect(screen.getByText('#42')).toBeInTheDocument();
  expect(screen.getByText('Fix login')).toBeInTheDocument();
});
```

### T3 — Filter by state

```typescript
test('filter dropdown shows only open issues', () => {
  // localStorage has 2 open + 1 closed
  render(<IssuesTab projectId="test" />);
  fireEvent.click(screen.getByLabelText('State filter'));
  fireEvent.click(screen.getByText('Open only'));
  expect(screen.getAllByText('open')).toHaveLength(2);
  expect(screen.queryByText('closed')).not.toBeInTheDocument();
});
```

### T4 — Filter by label

```typescript
test('label filter hides rows without matching label', () => {
  render(<IssuesTab projectId="test" />);
  fireEvent.click(screen.getByText('enhancement'));
  expect(screen.getByText('Add dark mode')).toBeInTheDocument();
  expect(screen.queryByText('Fix login')).not.toBeInTheDocument();
});
```

### T5 — Text search filters by title

```typescript
test('search input filters by title', () => {
  render(<IssuesTab projectId="test" />);
  fireEvent.change(screen.getByPlaceholderText('Search issues…'), { target: { value: 'login' } });
  expect(screen.getByText('Fix login')).toBeInTheDocument();
  expect(screen.queryByText('Add dark mode')).not.toBeInTheDocument();
});
```

### T6 — Dispatch opens modal

```typescript
test('dispatch button opens TaskDispatchModal', () => {
  render(<IssuesTab projectId="test" />);
  fireEvent.click(screen.getByText('Dispatch'));
  expect(screen.getByText('Task Dispatch')).toBeInTheDocument();
});
```

### T7 — No-token state shows guidance

```typescript
test('shows guidance when no token is configured', () => {
  // Mock bridge to return null token
  render(<IssuesTab projectId="test" />);
  expect(screen.getByText(/Configure GitHub token/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sync/ })).toBeDisabled();
});
```

---

## Manual Verification Checklist

1. Start `npm run dev` on port 43187 (browser mode)
2. Open Dashboard → see "Issues" tab
3. Click Issues tab → see "Sync Issues from GitHub" button
4. Configure GitHub token in Keys view → return to Issues tab → Sync button is enabled
5. Click Sync → issues load into table
6. Try state filter, label filter, search — rows update accordingly
7. Click a row → detail panel opens on the right with issue body
8. Click Dispatch → TaskDispatchModal appears with issue title pre-filled
9. Refresh page → cached issues persist
10. Remove token → next page load shows guidance again

---

## Rust / Tauri Command Spec

### `sync_github_issues`

```rust
#[tauri::command]
async fn sync_github_issues(
    project_root: String,
    github_token: String,
) -> Result<Vec<GithubIssue>, String>
```

Implementation:
1. Read `.project-manager/config.json` → extract `project.githubUrl`
2. Parse `owner/repo` from URL
3. Call `GET https://api.github.com/repos/{owner}/{repo}/issues?state=all&per_page=100`
4. Map response to `Vec<GithubIssue>`
5. Return parsed issues

### Browser mode fallback

In browser mode (`app/api/github/sync/route.ts`):
1. Read `GITHUB_TOKEN` from env
2. Proxy the GitHub API call
3. Return `GithubIssue[]`
