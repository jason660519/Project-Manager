# F04 TDD Spec — Add Project by GitHub URL

**Feature**: F04  
**Testing scope**: unit (URL validation, feature mapping, token persistence) + integration (end-to-end sync)

---

## Test Plan

### T1 — URL validation rejects malformed URLs

```typescript
// __tests__/f04.test.ts
import { parseGithubUrl } from '../app/api/github/lib';

test('accepts valid https://github.com/owner/repo', () => {
  const result = parseGithubUrl('https://github.com/owner/my-app');
  expect(result).toEqual({ owner: 'owner', repo: 'my-app' });
});

test('accepts trailing slash', () => {
  const result = parseGithubUrl('https://github.com/owner/my-app/');
  expect(result).toEqual({ owner: 'owner', repo: 'my-app' });
});

test('rejects non-github URLs', () => {
  expect(() => parseGithubUrl('https://gitlab.com/owner/repo')).toThrow('GitHub');
});

test('rejects URLs without owner/repo', () => {
  expect(() => parseGithubUrl('https://github.com')).toThrow('Invalid');
});
```

### T2 — GitHub feature mapping produces correct structure

```typescript
test('maps API response to GitHubFeature[]', () => {
  const mockResponse = {
    data: {
      repository: {
        pullRequests: { nodes: [{ number: 1, title: 'Fix login', updatedAt: '2026-05-15T00:00:00Z', isDraft: false, labels: { nodes: [{ name: 'bug' }] } }] },
        issues: { nodes: [{ number: 42, title: 'Add dark mode', labels: { nodes: [{ name: 'enhancement' }] } }] },
      },
    },
  };
  const features = mapGithubResponse(mockResponse, '2026-05-20T00:00:00Z');
  expect(features).toHaveLength(2);
  expect(features[0]).toMatchObject({ id: 'PR-1', name: 'Fix login', category: 'GitHub/PR' });
  expect(features[1]).toMatchObject({ id: 'ISS-42', name: 'Add dark mode', category: 'GitHub/Issue' });
});
```

### T3 — Idle PR detection (≥5 days)

```typescript
test('flags PR idle for 5+ days in notes', () => {
  const mock = makeMockPR(1, 'Stale PR', '2026-05-10T00:00:00Z'); // 10 days ago
  const features = mapGithubResponse(mock, '2026-05-20T00:00:00Z');
  expect(features[0].notes).toContain('idle');
});
```

### T4 — Token persistence round-trip (browser mode)

```typescript
test('saves and retrieves GitHub token via localStorage', () => {
  localStorage.setItem('projectManager-github-token', 'ghp_test');
  expect(localStorage.getItem('projectManager-github-token')).toBe('ghp_test');
});
```

### T5 — Create project config from GitHub import

```typescript
test('buildProjectEntryFromGithub creates config with fetched features', () => {
  const ghFeatures = [
    { id: 'PR-1', name: 'Fix login', category: 'GitHub/PR', status: 'in_progress', progress: 0 },
  ];
  const entry = buildProjectEntryFromGithub('test/project', ghFeatures);
  expect(entry.config.project.name).toBe('project');
  expect(entry.config.features).toHaveLength(1);
  expect(entry.configPath).toMatch(/^https:\/\/github\.com\/test\/project$/);
});
```

### T6 — Browser mode API proxy works

```typescript
// Integration: runs against dev server
test('GET /api/github/sync returns features for valid repo', async () => {
  const res = await fetch('/api/github/sync');
  // Requires running dev server + valid GITHUB_TOKEN in .env
  expect(res.ok).toBe(true);
});
```

---

## Manual Verification Checklist

1. Start `npm run dev` on port 43187
2. Go to Projects view → Add Project → GitHub URL tab
3. Paste `https://github.com/jason66x/Project-Manager`
4. Enter GitHub token → click Import
5. Verify new project entry appears with features from PRs/issues
6. Verify token persists across page reload (stored in localStorage for browser mode)
7. Delete the project → verify it's removed from the list
8. Re-import the same URL → verify no duplicate

---

## Browser API Route

Create `app/api/github/sync/route.ts`:
- Reads `GITHUB_TOKEN` from env
- Calls existing Rust `fetch_github_repo_inner` logic adapted for Node.js
- Returns `GitHubFeature[]` as JSON
- Used by `ProjectsView` in browser mode (non-Tauri fallback)
