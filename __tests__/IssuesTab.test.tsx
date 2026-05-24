import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../lib/i18n';
import { IssuesTab } from '../app/project-progress-dashboard/_components/IssuesTab';
import type { GithubIssue } from '../lib/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Keep a stubbed Tauri global so command-path code can be tested consistently.
vi.stubGlobal('__TAURI_INTERNALS__', {});

const mockGetGithubToken = vi.fn().mockResolvedValue('');
const mockFetchGithubIssues = vi.fn();
const mockFetchGithubIssueComments = vi.fn().mockResolvedValue([]);
const mockOnGithubUpdated = vi.fn().mockResolvedValue(() => {});
const mockCommentGithubIssue = vi.fn();
const mockCloseGithubIssueWithComment = vi.fn();
const mockReopenGithubIssueWithComment = vi.fn();
const mockCreateGithubIssue = vi.fn();
const mockUpdateGithubIssue = vi.fn();
const mockGithubOAuthDeviceStart = vi.fn();
const mockGithubOAuthDevicePoll = vi.fn();
const mockGetSecretsStorageBackend = vi.fn();
const mockGetSecret = vi.fn();
const mockSetSecret = vi.fn();

vi.mock('../lib/bridge', () => ({
  getGithubToken: (...args: any[]) => mockGetGithubToken(...args),
  fetchGithubIssues: (...args: any[]) => mockFetchGithubIssues(...args),
  fetchGithubIssueComments: (...args: any[]) => mockFetchGithubIssueComments(...args),
  onGithubUpdated: (...args: any[]) => mockOnGithubUpdated(...args),
  commentGithubIssue: (...args: any[]) => mockCommentGithubIssue(...args),
  closeGithubIssueWithComment: (...args: any[]) => mockCloseGithubIssueWithComment(...args),
  reopenGithubIssueWithComment: (...args: any[]) => mockReopenGithubIssueWithComment(...args),
  createGithubIssue: (...args: any[]) => mockCreateGithubIssue(...args),
  updateGithubIssue: (...args: any[]) => mockUpdateGithubIssue(...args),
  githubOAuthDeviceStart: (...args: any[]) => mockGithubOAuthDeviceStart(...args),
  githubOAuthDevicePoll: (...args: any[]) => mockGithubOAuthDevicePoll(...args),
  getSecretsStorageBackend: (...args: any[]) => mockGetSecretsStorageBackend(...args),
  getSecret: (...args: any[]) => mockGetSecret(...args),
  setSecret: (...args: any[]) => mockSetSecret(...args),
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
  selectedProjectNames: ['Test Project'],
  selectedProjects: [{ id: 'p1', name: 'Test Project', repoUrl: 'https://github.com/owner/repo' }],
  repoUrl: 'https://github.com/owner/repo',
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

function mockSyncIssue(issue: GithubIssue): any {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: issue.labels,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    url: issue.url,
    user: issue.user,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IssuesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockGetGithubToken.mockResolvedValue('test-token');
    mockFetch.mockReset();
    mockFetchGithubIssues.mockReset();
    mockFetchGithubIssueComments.mockResolvedValue([]);
    mockOnGithubUpdated.mockClear();
    mockOnGithubUpdated.mockResolvedValue(() => {});
    mockCommentGithubIssue.mockResolvedValue(OPEN_ISSUE);
    mockCloseGithubIssueWithComment.mockResolvedValue({ ...OPEN_ISSUE, state: 'closed' });
    mockReopenGithubIssueWithComment.mockResolvedValue({ ...CLOSED_ISSUE, state: 'open' });
    mockCreateGithubIssue.mockResolvedValue({ ...OPEN_ISSUE, number: 99, id: 99 });
    mockUpdateGithubIssue.mockResolvedValue(OPEN_ISSUE);
    mockGithubOAuthDeviceStart.mockResolvedValue({
      deviceCode: 'device-1',
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
      expiresIn: 900,
      interval: 30,
    });
    mockGithubOAuthDevicePoll.mockResolvedValue({ status: 'pending' });
    mockGetSecretsStorageBackend.mockResolvedValue('dev-file');
    mockGetSecret.mockResolvedValue(null);
    mockSetSecret.mockResolvedValue(undefined);
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

  it('shows selected/open/closed issue counters', async () => {
    seedCache(MOCK_ISSUES);
    renderIssuesTab({ selectedProjectNames: ['A', 'B'] });
    await waitFor(() => {
      expect(screen.getByText('Selected Projects')).toBeInTheDocument();
      expect(screen.getByText('Open Issues')).toBeInTheDocument();
      expect(screen.getByText('Closed Issues')).toBeInTheDocument();
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
      expect(screen.getByText(/Authorize GitHub before syncing/)).toBeInTheDocument();
    });

    const syncButton = screen.getByText('Authorize GitHub');
    expect(syncButton).toBeInTheDocument();
  });

  it('opens GitHub authorization when sync is clicked without a token', async () => {
    mockGetGithubToken.mockResolvedValue('');
    renderIssuesTab();

    await waitFor(() => expect(screen.getByText('Authorize GitHub')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Authorize GitHub'));

    await waitFor(() => {
      expect(mockGithubOAuthDeviceStart).toHaveBeenCalledWith(['repo', 'read:user']);
      expect(screen.getByText(/Sign in to GitHub Personal Access Token/)).toBeInTheDocument();
    });
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
      expect(screen.getAllByText(/The login page is broken/).length).toBeGreaterThan(0);
    });
  });

  it('syncs selected repositories and shows per-project counts', async () => {
    mockFetchGithubIssues
      .mockResolvedValueOnce([mockSyncIssue(OPEN_ISSUE)])
      .mockResolvedValueOnce([mockSyncIssue(CLOSED_ISSUE)]);

    renderIssuesTab({
      selectedProjects: [
        { id: 'p1', name: 'Alpha', repoUrl: 'https://github.com/org/repo-one' },
        { id: 'p2', name: 'Beta', repoUrl: 'https://github.com/org/repo-two' },
      ],
      selectedProjectNames: ['Alpha', 'Beta'],
    });

    fireEvent.click(screen.getByText('Sync Issues from GitHub'));

    await waitFor(() => {
      expect(screen.getByText('Open 1 · Closed 0 · Total 1')).toBeInTheDocument();
      expect(screen.getByText('Open 0 · Closed 1 · Total 1')).toBeInTheDocument();
      expect(screen.getByText('Fix login')).toBeInTheDocument();
      expect(screen.getByText('Add dark mode')).toBeInTheDocument();
    });
  });

  it('explains repository lookup failures as URL or authorization problems', async () => {
    mockFetchGithubIssues.mockRejectedValueOnce(
      new Error("GitHub GraphQL: Could not resolve to a Repository with the name 'owner/repo'."),
    );

    renderIssuesTab();
    fireEvent.click(screen.getByText('Sync Issues from GitHub'));

    await waitFor(() => {
      expect(screen.getAllByText(/Repository could not be reached/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Check the project GitHub URL/).length).toBeGreaterThan(0);
    });
  });

  it('blocks sync when the selected project has no GitHub repository URL', async () => {
    renderIssuesTab({
      selectedProjectNames: [],
      selectedProjects: [],
      repoUrl: undefined,
    });

    await waitFor(() => {
      expect(screen.getByText(/No GitHub repository URL is configured/)).toBeInTheDocument();
    });
    expect(screen.getByText('Sync Issues from GitHub')).toBeDisabled();
  });

  it('bulk comment applies to selected visible issues', async () => {
    seedCache([OPEN_ISSUE, ANOTHER_OPEN_ISSUE]);
    renderIssuesTab();

    await waitFor(() => expect(screen.getByText('#1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Select visible'));
    fireEvent.change(screen.getByPlaceholderText('Bulk comment for selected issues'), {
      target: { value: 'batch review note' },
    });
    await waitFor(() => expect(screen.getByText(/Selected issues:/).textContent).toContain('2'));
    fireEvent.click(screen.getByText('Add Comment to Selected'));

    await waitFor(() => {
      expect(mockCommentGithubIssue).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Added comment to 2 issue(s).')).toBeInTheDocument();
    });
  });

  it('reopen button is enabled for closed issue in detail', async () => {
    seedCache([CLOSED_ISSUE]);
    renderIssuesTab();

    await waitFor(() => expect(screen.getByText('#2')).toBeInTheDocument());
    fireEvent.click(screen.getByText('#2'));

    await waitFor(() => {
      const reopenButton = screen.getByText('Reopen');
      const closeButton = screen.getByText('Close with Comment');
      expect(reopenButton).not.toBeDisabled();
      expect(closeButton).toBeDisabled();
    });
  });

  it('loads and displays review timeline comments for selected issue', async () => {
    mockFetchGithubIssueComments.mockResolvedValueOnce([
      {
        id: 999,
        body: 'Looks good, ship it.',
        createdAt: new Date(Date.now() - 5000).toISOString(),
        updatedAt: new Date(Date.now() - 2000).toISOString(),
        url: 'https://github.com/owner/repo/issues/1#issuecomment-999',
        user: 'reviewer-bot',
      },
    ]);

    seedCache([OPEN_ISSUE]);
    renderIssuesTab();

    await waitFor(() => expect(screen.getByText('#1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('#1'));

    await waitFor(() => {
      expect(screen.getByText('Review Timeline')).toBeInTheDocument();
      expect(screen.getByText(/Looks good, ship it/)).toBeInTheDocument();
      expect(screen.getByText(/reviewer-bot/)).toBeInTheDocument();
    });
  });
});
