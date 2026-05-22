import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../lib/i18n';
import { IssuesTab } from '../app/project-progress-dashboard/_components/IssuesTab';
import type { GithubIssue } from '../lib/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock `__TAURI_INTERNALS__` to be absent so we're in browser mode for tests
vi.stubGlobal('__TAURI_INTERNALS__', undefined);

const mockGetGithubToken = vi.fn().mockResolvedValue('');
const mockFetchGithubIssues = vi.fn();

vi.mock('../lib/bridge', () => ({
  getGithubToken: (...args: any[]) => mockGetGithubToken(...args),
  fetchGithubIssues: (...args: any[]) => mockFetchGithubIssues(...args),
}));

// Mock global fetch for browser-mode API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Test data ─────────────────────────────────────────────────────────────────

const OPEN_ISSUE: GithubIssue = {
  id: 1,
  number: 1,
  title: 'Fix login',
  body: 'The login page is broken',
  state: 'open',
  labels: ['bug'],
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: new Date(Date.now() - 3600_000).toISOString(),
  url: 'https://github.com/owner/repo/issues/1',
  user: 'jason',
};

const CLOSED_ISSUE: GithubIssue = {
  id: 2,
  number: 2,
  title: 'Add dark mode',
  body: 'Implement dark mode toggle',
  state: 'closed',
  labels: ['enhancement'],
  createdAt: '2026-05-02T00:00:00Z',
  updatedAt: new Date(Date.now() - 7200_000).toISOString(),
  url: 'https://github.com/owner/repo/issues/2',
  user: 'jason',
};

const ANOTHER_OPEN_ISSUE: GithubIssue = {
  id: 3,
  number: 3,
  title: 'Fix navbar',
  body: 'Navbar is misaligned',
  state: 'open',
  labels: ['bug', 'ui'],
  createdAt: '2026-05-03T00:00:00Z',
  updatedAt: new Date(Date.now() - 1800_000).toISOString(),
  url: 'https://github.com/owner/repo/issues/3',
  user: 'jason',
};

const MOCK_ISSUES = [OPEN_ISSUE, CLOSED_ISSUE, ANOTHER_OPEN_ISSUE];

const defaultProps = {
  projectName: 'Test Project',
  projectRoot: '/test/project',
  storyPoints: 42,
  adapters: [{ id: 'claude-code', name: 'Claude Code', type: 'agent' as const, command: 'claude', argsTemplate: [] }],
  engineerRoles: [],
  defaultIDE: 'Cursor' as const,
  onDispatchIssue: vi.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderIssuesTab(overrides: Partial<typeof defaultProps> = {}) {
  return render(
    <I18nProvider>
      <IssuesTab {...defaultProps} {...overrides} />
    </I18nProvider>,
  );
}

function seedCache(issues: GithubIssue[], projectName = 'Test Project'): void {
  const key = `pm-issues-${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  window.localStorage.setItem(key, JSON.stringify({ issues, syncedAt: Date.now() }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IssuesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockGetGithubToken.mockResolvedValue('');
    mockFetch.mockReset();
  });

  // T1 — IssuesTab renders sync button when no cached issues
  it('shows sync button when cache is empty', async () => {
    renderIssuesTab();
    // The component loads asynchronously — wait for the sync button to appear
    await waitFor(() => {
      expect(screen.getByText('Sync Issues from GitHub')).toBeInTheDocument();
    });
  });

  // T2 — Cached issues render as rows
  it('renders issue rows from cache', async () => {
    seedCache([OPEN_ISSUE]);
    renderIssuesTab();
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('Fix login')).toBeInTheDocument();
    });
  });

  // T3 — Filter by state
  it('filter dropdown shows only open issues', async () => {
    seedCache(MOCK_ISSUES);
    renderIssuesTab();

    // Wait for issues to render
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    // Initially all issues shown (2 open + 1 closed)
    expect(screen.getByText('#2')).toBeInTheDocument(); // closed issue

    // Filter to open only
    fireEvent.change(screen.getByLabelText('State filter'), { target: { value: 'open' } });

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
      // Closed issue should not be visible
      expect(screen.queryByText('#2')).not.toBeInTheDocument();
    });
  });

  // T4 — Filter by label
  it('label filter hides rows without matching label', async () => {
    seedCache(MOCK_ISSUES);
    renderIssuesTab();

    // Wait for label filter buttons to render
    await waitFor(() => {
      expect(screen.getAllByText('enhancement').length).toBeGreaterThanOrEqual(1);
    });

    // Click on the "enhancement" label filter button (the <button> in the toolbar,
    // not the <span> badge in the table row)
    const allEnhancement = screen.getAllByText('enhancement');
    const filterButton = allEnhancement.find((el) => el.tagName === 'BUTTON');
    expect(filterButton).toBeDefined();
    fireEvent.click(filterButton!);

    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument(); // 'Add dark mode' has label 'enhancement'
      expect(screen.queryByText('#1')).not.toBeInTheDocument(); // 'Fix login' has label 'bug'
      expect(screen.queryByText('#3')).not.toBeInTheDocument(); // 'Fix navbar' has labels 'bug', 'ui'
    });
  });

  // T5 — Text search filters by title
  it('search input filters by title', async () => {
    seedCache(MOCK_ISSUES);
    renderIssuesTab();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    // Search for "login"
    const searchInput = screen.getByPlaceholderText('Search issues…');
    fireEvent.change(searchInput, { target: { value: 'login' } });

    await waitFor(() => {
      expect(screen.getByText('Fix login')).toBeInTheDocument();
      expect(screen.queryByText('Add dark mode')).not.toBeInTheDocument();
    });
  });

  // T6 — Dispatch button exists in table rows
  it('dispatch buttons are rendered for each issue', async () => {
    seedCache([OPEN_ISSUE]);
    const onDispatch = vi.fn();
    renderIssuesTab({ onDispatchIssue: onDispatch });

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    const dispatchButtons = screen.getAllByText('Dispatch');
    expect(dispatchButtons.length).toBeGreaterThanOrEqual(1);
  });

  // T7 — No-token state shows guidance
  it('shows guidance when no token is configured', async () => {
    mockGetGithubToken.mockResolvedValue('');
    renderIssuesTab();

    await waitFor(() => {
      expect(screen.getByText(/Configure GitHub token/)).toBeInTheDocument();
    });

    // Sync button should be rendered. It may be disabled due to no token.
    const syncButton = screen.getByText('Sync Issues from GitHub');
    expect(syncButton).toBeInTheDocument();
  });

  // T8 — Row click opens detail panel
  it('clicking a row shows issue detail panel', async () => {
    seedCache([OPEN_ISSUE]);
    renderIssuesTab();

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    // Click the row
    fireEvent.click(screen.getByText('#1'));

    // Detail should show issue body
    await waitFor(() => {
      expect(screen.getByText(/The login page is broken/)).toBeInTheDocument();
    });
  });
});
