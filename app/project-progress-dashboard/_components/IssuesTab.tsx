'use client';

// @table-classification: basic
// @table-reason: GitHub Issues dashboard sheet is an operational table with
//   UUID row identity, issue-number human key, table-scoped search, status/type
//   filters, numeric freeze columns, hidden columns, resize controls, sorting,
//   empty states, and issue actions.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type MouseEvent, type ReactNode, type SetStateAction } from 'react';
import {
  AlertCircle,
  CheckCircle,
  EyeOff,
  ExternalLink,
  GitPullRequest,
  KeyRound,
  MessageSquarePlus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Snowflake,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { COL_ID_COLUMN_HEADER } from '../../../components/table/colId';
import { uuidv5 } from '../../../lib/aiSdks/uuid';
import type { AnyAdapterConfig, EngineerRole, GithubIssue, IDEId } from '../../../lib/types';
import {
  fetchGithubIssueComments,
  closeGithubIssueWithComment,
  commentGithubIssue,
  createGithubIssue,
  fetchGithubIssues,
  getGithubToken,
  onGithubUpdated,
  reopenGithubIssueWithComment,
  updateGithubIssue,
  type GithubIssueCommentPayload,
} from '../../../lib/bridge';
import { PROVIDERS } from '../../../lib/keys/registry';
import { OAuthDeviceModal } from '../../ui/views/_components/OAuthDeviceModal';
import { useInAppPrompt } from '../../../components/ui/InAppDialog';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IssuesTabProps {
  projectName: string;
  selectedProjectNames: string[];
  selectedProjects: Array<{
    id: string;
    name: string;
    repoUrl?: string;
  }>;
  repoUrl?: string;
  projectRoot: string;
  storyPoints: number;
  adapters: AnyAdapterConfig[];
  engineerRoles: EngineerRole[];
  defaultIDE: IDEId;
  onDispatchIssue: (issue: { title: string }) => void;
}

interface CachedIssues {
  issues: DetailIssue[];
  syncedAt: number | Record<string, number>;
}

interface FilterState {
  state: 'all' | 'open' | 'closed';
  label: string | null;
  search: string;
}

interface DetailIssue extends GithubIssue {
  linkedFeatureId?: string;
  repoUrl: string;
  projectName: string;
  repoName: string;
}

interface RepoTarget {
  repoUrl: string;
  projectName: string;
  repoName: string;
}

interface RepoSyncState {
  loading: boolean;
  error: string | null;
  syncedAt: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'pm-issues-';
const ISSUES_TABLE_PREFS_KEY = 'projectManager.progressDashboard.issuesTable.v2';
const GITHUB_PROVIDER = PROVIDERS.find((provider) => provider.id === 'github') ?? null;
const ISSUE_ROW_ID_NAMESPACE = 'f2cbb027-6f2b-46f0-9d7a-9f20a76dd0c4';
const ISSUE_COLUMN_DEFS = [
  { id: 'col-select', label: 'Sel', width: 44, sortable: false },
  { id: 'col-id', label: COL_ID_COLUMN_HEADER, width: 144, sortable: true },
  { id: 'col-issue-number', label: 'Issue #', width: 88, sortable: true },
  { id: 'col-project', label: 'Project', width: 132, sortable: true },
  { id: 'col-title', label: 'Title', width: 320, sortable: true },
  { id: 'col-status', label: 'Status', width: 88, sortable: true },
  { id: 'col-labels', label: 'Labels', width: 180, sortable: false },
  { id: 'col-updated', label: 'Updated', width: 108, sortable: true },
  { id: 'col-actions', label: 'Action', width: 92, sortable: false },
] as const;

type IssueColumnId = (typeof ISSUE_COLUMN_DEFS)[number]['id'];
type IssueSort = { columnId: IssueColumnId; direction: 'asc' | 'desc' } | null;

function issueRowUuid(issue: Pick<DetailIssue, 'repoUrl' | 'number'>): string {
  return uuidv5(`${issue.repoUrl}#${issue.number}`, ISSUE_ROW_ID_NAMESPACE);
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const AUTO_SYNC_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(projectName: string): string {
  return `${CACHE_PREFIX}${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function readCache(projectName: string): CachedIssues | null {
  try {
    const raw = localStorage.getItem(cacheKey(projectName));
    if (!raw) return null;
    return JSON.parse(raw) as CachedIssues;
  } catch {
    return null;
  }
}

function writeCache(projectName: string, issues: DetailIssue[]): void {
  try {
    localStorage.setItem(
      cacheKey(projectName),
      JSON.stringify({ issues, syncedAt: Date.now() }),
    );
  } catch {
    /* quota exceeded — drop silently */
  }
}

function clearCache(projectName: string): void {
  try {
    localStorage.removeItem(cacheKey(projectName));
  } catch {
    /* noop */
  }
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function extractAllLabels(issues: GithubIssue[]): string[] {
  const set = new Set<string>();
  for (const issue of issues) {
    for (const label of issue.labels) {
      set.add(label);
    }
  }
  return Array.from(set).sort();
}

function describeGithubIssueError(reason: string, repoName?: string): string {
  const target = repoName ? `${repoName}: ` : '';
  const low = reason.toLowerCase();

  if (low.includes('github token not configured') || low.includes('authorization is required')) {
    return `${target}GitHub authorization is required before Project Manager can sync issues.`;
  }
  if (
    low.includes('could not resolve to a repository')
    || low.includes('not found')
    || low.includes('github api 404')
  ) {
    return `${target}Repository could not be reached. Check the project GitHub URL, or authorize a GitHub account that can access this repository.`;
  }
  if (low.includes('bad credentials') || low.includes('unauthorized') || low.includes('github api 401')) {
    return `${target}GitHub authorization is invalid or expired. Re-authorize GitHub, then sync again.`;
  }
  if (
    low.includes('resource not accessible')
    || low.includes('insufficient')
    || low.includes('scope')
    || low.includes('github api 403')
  ) {
    return `${target}GitHub authorization does not have enough repository or issue permission. Re-authorize with repo access, then sync again.`;
  }
  if (low.includes('rate limit')) {
    return `${target}GitHub rate limit was reached. Wait before syncing again, or use a token with a higher allowance.`;
  }

  return `${target}${reason}`;
}

// ── Browser mode sync (proxies through Next.js API route) ─────────────────────

async function browserSyncIssues(repoUrl: string): Promise<GithubIssue[]> {
  const res = await fetch('/api/github/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub sync failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<GithubIssue[]>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IssuesTab({
  projectName, selectedProjectNames, selectedProjects, repoUrl, projectRoot, storyPoints,
  adapters, engineerRoles, defaultIDE, onDispatchIssue,
}: IssuesTabProps) {
  const [issues, setIssues] = useState<DetailIssue[]>([]);
  const [detailIssue, setDetailIssue] = useState<DetailIssue | null>(null);
  const [syncedAt, setSyncedAt] = useState<Record<string, number>>({});
  const [repoSyncState, setRepoSyncState] = useState<Record<string, RepoSyncState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState<boolean | null>(null); // null = unknown
  const [filter, setFilter] = useState<FilterState>({ state: 'all', label: null, search: '' });
  const [dispatching, setDispatching] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [createRepoUrl, setCreateRepoUrl] = useState('');
  const [selectedIssueKeys, setSelectedIssueKeys] = useState<string[]>([]);
  const [bulkCommentDraft, setBulkCommentDraft] = useState('');
  const [bulkMutating, setBulkMutating] = useState(false);
  const [comments, setComments] = useState<GithubIssueCommentPayload[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [oauthOpen, setOauthOpen] = useState(false);
  const [issueSort, setIssueSort] = useState<IssueSort>(null);
  const [issueFreezeCols, setIssueFreezeCols] = useState(0);
  const [issueRowHeight, setIssueRowHeight] = useState(40);
  const [issueColumnWidths, setIssueColumnWidths] = useState<Record<IssueColumnId, number>>(() => (
    Object.fromEntries(ISSUE_COLUMN_DEFS.map((column) => [column.id, column.width])) as Record<IssueColumnId, number>
  ));
  const [hiddenIssueColumnIds, setHiddenIssueColumnIds] = useState<IssueColumnId[]>([]);
  const [showIssueHiddenCols, setShowIssueHiddenCols] = useState(false);
  const [hiddenIssueRowKeys, setHiddenIssueRowKeys] = useState<string[]>([]);
  const [showIssueHiddenRows, setShowIssueHiddenRows] = useState(false);
  const [showIssueHiddenRowsMenu, setShowIssueHiddenRowsMenu] = useState(false);

  const initialized = useRef(false);
  // Stable ref so auto-sync effects can call the latest onSync without
  // restarting their intervals/listeners every time syncedAt changes.
  const onSyncRef = useRef<() => Promise<void>>(async () => {});
  const effectiveRepoUrl = (repoUrl ?? '').trim();
  const repoTargets = useMemo<RepoTarget[]>(() => {
    const fromSelected = selectedProjects
      .map((project) => {
        const url = (project.repoUrl ?? '').trim();
        if (!url) return null;
        const segments = url.replace(/\/+$/, '').replace(/\.git$/, '').split('/');
        return {
          repoUrl: url,
          projectName: project.name,
          repoName: segments.slice(-2).join('/'),
        } satisfies RepoTarget;
      })
      .filter((row): row is RepoTarget => row !== null);

    if (fromSelected.length > 0) {
      const byRepo = new Map<string, RepoTarget>();
      fromSelected.forEach((repo) => {
        if (!byRepo.has(repo.repoUrl)) byRepo.set(repo.repoUrl, repo);
      });
      return Array.from(byRepo.values());
    }

    if (!effectiveRepoUrl) return [];

    const fallbackSegments = effectiveRepoUrl.replace(/\/+$/, '').replace(/\.git$/, '').split('/');
    return [{
      repoUrl: effectiveRepoUrl,
      projectName,
      repoName: fallbackSegments.slice(-2).join('/'),
    }];
  }, [selectedProjects, effectiveRepoUrl, projectName]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ISSUES_TABLE_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        sort: IssueSort;
        freezeCols: number;
        rowHeight: number;
        widths: Record<IssueColumnId, number>;
        hidden: IssueColumnId[];
        hiddenRows: string[];
      }>;
      setIssueSort(parsed.sort ?? null);
      setIssueFreezeCols(Math.max(0, Math.min(5, parsed.freezeCols ?? 0)));
      setIssueRowHeight(Math.max(32, Math.min(160, parsed.rowHeight ?? 40)));
      if (parsed.widths) {
        setIssueColumnWidths((prev) => ({ ...prev, ...parsed.widths }));
      }
      if (Array.isArray(parsed.hidden)) {
        setHiddenIssueColumnIds(parsed.hidden.filter((id) => id !== 'col-id'));
      }
      if (Array.isArray(parsed.hiddenRows)) {
        setHiddenIssueRowKeys(parsed.hiddenRows.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      /* malformed prefs are ignored */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ISSUES_TABLE_PREFS_KEY, JSON.stringify({
        sort: issueSort,
        freezeCols: issueFreezeCols,
        rowHeight: issueRowHeight,
        widths: issueColumnWidths,
        hidden: hiddenIssueColumnIds,
        hiddenRows: hiddenIssueRowKeys,
      }));
    } catch {
      /* preference save is non-blocking */
    }
  }, [hiddenIssueColumnIds, hiddenIssueRowKeys, issueColumnWidths, issueFreezeCols, issueRowHeight, issueSort]);

  // On mount: load from cache, check token.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const cached = readCache(projectName);
    if (cached) {
      const fallbackRepo = repoTargets[0];
      const normalized = cached.issues.map((issue) => ({
        ...issue,
        repoUrl: issue.repoUrl ?? fallbackRepo?.repoUrl ?? effectiveRepoUrl,
        projectName: issue.projectName ?? fallbackRepo?.projectName ?? projectName,
        repoName: issue.repoName ?? fallbackRepo?.repoName ?? effectiveRepoUrl.replace(/\/+$/, '').split('/').slice(-2).join('/'),
      }));
      setIssues(normalized);
      const legacySyncedAt = typeof cached.syncedAt === 'number' ? cached.syncedAt : null;
      const syncedAtByRepo = typeof cached.syncedAt === 'number' ? {} : cached.syncedAt;
      const syncedByRepo = normalized.reduce<Record<string, number>>((acc, issue) => {
        if (!acc[issue.repoUrl]) {
          acc[issue.repoUrl] = syncedAtByRepo[issue.repoUrl] ?? legacySyncedAt ?? Date.now();
        }
        return acc;
      }, {});
      setSyncedAt(syncedByRepo);
    }

    // Check if token is available
    (async () => {
      try {
        const token = await getGithubToken();
        setHasToken(token.length > 0);
      } catch {
        setHasToken(false);
      }
    })();
  }, [projectName, repoTargets, effectiveRepoUrl]);

  useEffect(() => {
    if (!createRepoUrl && repoTargets.length > 0) {
      setCreateRepoUrl(repoTargets[0]!.repoUrl);
    }
  }, [createRepoUrl, repoTargets]);

  // Sync callback: Tauri or browser mode.
  const onSync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (repoTargets.length === 0) {
        throw new Error('No GitHub repository URL is configured for the selected project.');
      }
      let token = '';
      if (isTauri()) {
        token = await getGithubToken();
        if (!token) {
          setHasToken(false);
          throw new Error('GitHub token not configured');
        }
      }

      setRepoSyncState((prev) => {
        const next = { ...prev };
        repoTargets.forEach((repo) => {
          next[repo.repoUrl] = { loading: true, error: null, syncedAt: prev[repo.repoUrl]?.syncedAt ?? null };
        });
        return next;
      });

      const syncResults = await Promise.allSettled(
        repoTargets.map(async (repo): Promise<{ repo: RepoTarget; issues: DetailIssue[] }> => {
          const fetched = isTauri()
            ? await fetchGithubIssues(token, repo.repoUrl)
            : await browserSyncIssues(repo.repoUrl);

          const mapped: DetailIssue[] = fetched.map((issue) => ({
            id: issue.number,
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state === 'closed' ? 'closed' : 'open',
            labels: issue.labels,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
            url: issue.url,
            user: issue.user,
            repoUrl: repo.repoUrl,
            projectName: repo.projectName,
            repoName: repo.repoName,
          }));
          return { repo, issues: mapped };
        }),
      );

      const now = Date.now();
      const nextIssues: DetailIssue[] = [];
      const nextSync: Record<string, number> = { ...syncedAt };
      const nextRepoState: Record<string, RepoSyncState> = { ...repoSyncState };
      const errors: string[] = [];

      syncResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          const { repo, issues: repoIssues } = result.value;
          nextIssues.push(...repoIssues);
          nextSync[repo.repoUrl] = now;
          nextRepoState[repo.repoUrl] = { loading: false, error: null, syncedAt: now };
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          const failedRepo = repoTargets[idx];
          if (failedRepo) {
            const friendlyReason = describeGithubIssueError(reason, failedRepo.repoName);
            nextRepoState[failedRepo.repoUrl] = {
              loading: false,
              error: friendlyReason,
              syncedAt: repoSyncState[failedRepo.repoUrl]?.syncedAt ?? null,
            };
            errors.push(friendlyReason);
          }
        }
      });

      setRepoSyncState(nextRepoState);
      setIssues(nextIssues);
      setSyncedAt(nextSync);
      writeCache(projectName, nextIssues);
      if (errors.length > 0) {
        setError(`Some repositories failed to sync. ${errors.join(' | ')}`);
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Sync failed';
      setError(describeGithubIssueError(reason));
      setRepoSyncState((prev) => {
        const next = { ...prev };
        repoTargets.forEach((repo) => {
          next[repo.repoUrl] = {
            loading: false,
            error: describeGithubIssueError(reason, repo.repoName),
            syncedAt: prev[repo.repoUrl]?.syncedAt ?? null,
          };
        });
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [projectName, repoTargets, repoSyncState, syncedAt]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    let result = issues;
    const hiddenRows = new Set(hiddenIssueRowKeys);

    if (!showIssueHiddenRows) {
      result = result.filter((i) => !hiddenRows.has(`${i.repoUrl}#${i.number}`));
    }
    if (filter.state !== 'all') {
      result = result.filter((i) => i.state === filter.state);
    }
    if (filter.label) {
      result = result.filter((i) => i.labels.includes(filter.label!));
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        `#${i.number}`.includes(q) ||
        issueRowUuid(i).includes(q) ||
        i.projectName.toLowerCase().includes(q) ||
        i.repoName.toLowerCase().includes(q),
      );
    }

    if (!issueSort) return result;
    return [...result].sort((a, b) => {
      const read = (issue: DetailIssue): string | number => {
        switch (issueSort.columnId) {
          case 'col-id': return issueRowUuid(issue);
          case 'col-issue-number': return issue.number;
          case 'col-project': return issue.projectName;
          case 'col-title': return issue.title;
          case 'col-status': return issue.state;
          case 'col-updated': return new Date(issue.updatedAt).getTime();
          default: return '';
        }
      };
      const av = read(a);
      const bv = read(b);
      const direction = issueSort.direction === 'asc' ? 1 : -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * direction;
    });
  }, [issues, filter, hiddenIssueRowKeys, issueSort, showIssueHiddenRows]);

  const allLabels = useMemo(() => extractAllLabels(issues), [issues]);
  const openCount = useMemo(() => issues.filter((issue) => issue.state === 'open').length, [issues]);
  const closedCount = useMemo(() => issues.filter((issue) => issue.state === 'closed').length, [issues]);
  const selectedProjectsCount = selectedProjectNames.length > 0 ? selectedProjectNames.length : repoTargets.length;
  const perRepoCounts = useMemo(
    () =>
      repoTargets.map((repo) => {
        const repoIssues = issues.filter((issue) => issue.repoUrl === repo.repoUrl);
        const open = repoIssues.filter((issue) => issue.state === 'open').length;
        const closed = repoIssues.filter((issue) => issue.state === 'closed').length;
        return { ...repo, total: repoIssues.length, open, closed };
      }),
    [issues, repoTargets],
  );
  const selectedIssues = useMemo(
    () => issues.filter((issue) => selectedIssueKeys.includes(`${issue.repoUrl}#${issue.number}`)),
    [issues, selectedIssueKeys],
  );
  const hiddenIssueRows = useMemo(() => {
    const hidden = new Set(hiddenIssueRowKeys);
    return issues
      .filter((issue) => hidden.has(`${issue.repoUrl}#${issue.number}`))
      .map((issue) => ({
        key: `${issue.repoUrl}#${issue.number}`,
        label: `#${issue.number} · ${issue.title}`,
      }));
  }, [hiddenIssueRowKeys, issues]);
  const allVisibleSelected = filteredIssues.length > 0
    && filteredIssues.every((issue) => selectedIssueKeys.includes(`${issue.repoUrl}#${issue.number}`));

  const handleRowClick = useCallback((issue: DetailIssue) => {
    setDetailIssue((prev) =>
      prev?.number === issue.number && prev.repoUrl === issue.repoUrl ? null : issue,
    );
  }, []);

  const handleOAuthAuthorized = useCallback(() => {
    setOauthOpen(false);
    setHasToken(true);
    setError(null);
    setActionNotice('GitHub authorized. Sync issues to refresh repository state.');
  }, []);

  const handleSyncAction = useCallback(() => {
    if (hasToken === false) {
      if (isTauri() && GITHUB_PROVIDER) {
        setOauthOpen(true);
      } else {
        setError('GitHub token not configured. Add GITHUB_TOKEN in browser development mode, or use the desktop app to authorize GitHub.');
      }
      return;
    }
    void onSync();
  }, [hasToken, onSync]);

  // Keep the ref current so auto-sync effects always call the latest onSync.
  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  // Auto-sync when token becomes available and cached data is stale (>5 min).
  useEffect(() => {
    if (hasToken !== true || repoTargets.length === 0) return;
    const now = Date.now();
    const anyStale = repoTargets.some((r) => {
      const t = syncedAt[r.repoUrl];
      return !t || now - t > AUTO_SYNC_MS;
    });
    if (anyStale) void onSyncRef.current();
    // Intentional: only fires when hasToken flips to true, not on every syncedAt update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  // Tauri: auto-refresh when the background poll fires for a watched repo.
  // Bridges the gap so the Issues tab stays current without manual "Sync" clicks.
  useEffect(() => {
    if (!isTauri() || repoTargets.length === 0) return;
    const watchedUrls = new Set(repoTargets.map((r) => r.repoUrl));
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await onGithubUpdated(({ repoUrl }) => {
        if (watchedUrls.has(repoUrl)) void onSyncRef.current();
      });
    })();
    return () => unlisten?.();
  }, [repoTargets]);

  // Browser/web mode: periodic sync every 5 minutes (Tauri uses startGithubPoll instead).
  useEffect(() => {
    if (isTauri() || hasToken !== true || repoTargets.length === 0) return;
    const id = setInterval(() => void onSyncRef.current(), AUTO_SYNC_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, repoTargets]);

  useEffect(() => {
    if (!detailIssue) return;
    setEditTitle(detailIssue.title);
    setEditBody(detailIssue.body ?? '');
    setCommentDraft('');
  }, [detailIssue]);

  useEffect(() => {
    if (!detailIssue) {
      setComments([]);
      setCommentsError(null);
      setCommentsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        const token = isTauri() ? await getGithubToken() : '';
        const list = await fetchGithubIssueComments(token, detailIssue.repoUrl, detailIssue.number);
        if (!cancelled) setComments(list);
      } catch (e) {
        if (!cancelled) {
          setComments([]);
          setCommentsError(e instanceof Error ? e.message : 'Failed to load comments');
        }
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailIssue]);

  const applyIssueUpdate = useCallback((updated: DetailIssue) => {
    setIssues((prev) => {
      const next = prev.some((item) => item.number === updated.number)
        ? prev.map((item) => (
          item.number === updated.number && item.repoUrl === updated.repoUrl ? updated : item
        ))
        : [updated, ...prev];
      writeCache(projectName, next);
      return next;
    });
    setDetailIssue((prev) => (
      prev?.number === updated.number && prev.repoUrl === updated.repoUrl ? updated : prev
    ));
    setSyncedAt((prev) => ({ ...prev, [updated.repoUrl]: Date.now() }));
  }, [projectName]);

  const runIssueMutation = useCallback(async <T,>(repoUrlForAction: string, runner: (token: string) => Promise<T>): Promise<T> => {
    if (!repoUrlForAction) {
      throw new Error('Missing GitHub repository URL');
    }
    if (isTauri()) {
      const token = await getGithubToken();
      if (!token) {
        setHasToken(false);
        throw new Error('GitHub token not configured');
      }
      return runner(token);
    }
    return runner('');
  }, []);

  const handleDispatch = useCallback((issue: GithubIssue) => {
    setDispatching(true);
    onDispatchIssue(issue);
    // Reset after a tick to allow the parent to open the modal
    setTimeout(() => setDispatching(false), 100);
  }, [onDispatchIssue]);

  const handleCreateIssue = useCallback(async () => {
    const title = createTitle.trim();
    if (!title) return;
    const targetRepo = createRepoUrl || repoTargets[0]?.repoUrl || effectiveRepoUrl;
    if (!targetRepo) {
      setError('No GitHub repository URL is configured for the selected project.');
      return;
    }
    setMutating(true);
    setError(null);
    setActionNotice(null);
    try {
      const repoMeta = repoTargets.find((repo) => repo.repoUrl === targetRepo) ?? repoTargets[0];
      const created = await runIssueMutation(targetRepo, (token) => createGithubIssue(token, {
        repoUrl: targetRepo,
        title,
        body: createBody.trim() || undefined,
      }));
      applyIssueUpdate({
        ...created,
        repoUrl: targetRepo,
        projectName: repoMeta?.projectName ?? projectName,
        repoName: repoMeta?.repoName ?? targetRepo.replace(/\/+$/, '').split('/').slice(-2).join('/'),
      });
      setCreateTitle('');
      setCreateBody('');
      setCreateOpen(false);
      setActionNotice(`Created issue #${created.number} in ${repoMeta?.repoName ?? targetRepo}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create issue failed');
    } finally {
      setMutating(false);
    }
  }, [applyIssueUpdate, createBody, createTitle, createRepoUrl, repoTargets, effectiveRepoUrl, runIssueMutation, projectName]);

  const handleUpdateIssue = useCallback(async () => {
    if (!detailIssue) return;
    setMutating(true);
    setError(null);
    setActionNotice(null);
    try {
      const updated = await runIssueMutation(detailIssue.repoUrl, (token) => updateGithubIssue(token, {
        repoUrl: detailIssue.repoUrl,
        issueNumber: detailIssue.number,
        title: editTitle.trim() || detailIssue.title,
        body: editBody,
      }));
      applyIssueUpdate({ ...updated, repoUrl: detailIssue.repoUrl, projectName: detailIssue.projectName, repoName: detailIssue.repoName });
      setActionNotice(`Updated issue #${updated.number}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update issue failed');
    } finally {
      setMutating(false);
    }
  }, [applyIssueUpdate, detailIssue, editBody, editTitle, runIssueMutation]);

  const handleCommentIssue = useCallback(async () => {
    if (!detailIssue) return;
    const comment = commentDraft.trim();
    if (!comment) return;
    setMutating(true);
    setError(null);
    setActionNotice(null);
    try {
      const updated = await runIssueMutation(detailIssue.repoUrl, (token) => commentGithubIssue(token, {
        repoUrl: detailIssue.repoUrl,
        issueNumber: detailIssue.number,
        comment,
      }));
      applyIssueUpdate({ ...updated, repoUrl: detailIssue.repoUrl, projectName: detailIssue.projectName, repoName: detailIssue.repoName });
      setCommentDraft('');
      setActionNotice(`Comment added to #${updated.number}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add comment failed');
    } finally {
      setMutating(false);
    }
  }, [applyIssueUpdate, commentDraft, detailIssue, runIssueMutation]);

  const handleCloseWithComment = useCallback(async () => {
    if (!detailIssue) return;
    setMutating(true);
    setError(null);
    setActionNotice(null);
    try {
      const updated = await runIssueMutation(detailIssue.repoUrl, (token) => closeGithubIssueWithComment(token, {
        repoUrl: detailIssue.repoUrl,
        issueNumber: detailIssue.number,
        comment: commentDraft.trim() || undefined,
      }));
      applyIssueUpdate({ ...updated, repoUrl: detailIssue.repoUrl, projectName: detailIssue.projectName, repoName: detailIssue.repoName });
      setCommentDraft('');
      setActionNotice(`Closed issue #${updated.number}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Close issue failed');
    } finally {
      setMutating(false);
    }
  }, [applyIssueUpdate, commentDraft, detailIssue, runIssueMutation]);

  const handleReopenWithComment = useCallback(async () => {
    if (!detailIssue) return;
    setMutating(true);
    setError(null);
    setActionNotice(null);
    try {
      const updated = await runIssueMutation(detailIssue.repoUrl, (token) => reopenGithubIssueWithComment(token, {
        repoUrl: detailIssue.repoUrl,
        issueNumber: detailIssue.number,
        comment: commentDraft.trim() || undefined,
      }));
      applyIssueUpdate({ ...updated, repoUrl: detailIssue.repoUrl, projectName: detailIssue.projectName, repoName: detailIssue.repoName });
      setCommentDraft('');
      setActionNotice(`Reopened issue #${updated.number}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reopen issue failed');
    } finally {
      setMutating(false);
    }
  }, [applyIssueUpdate, commentDraft, detailIssue, runIssueMutation]);

  const toggleIssueSelection = useCallback((issue: DetailIssue) => {
    const key = `${issue.repoUrl}#${issue.number}`;
    setSelectedIssueKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }, []);

  const toggleAllVisible = useCallback(() => {
    const visibleKeys = filteredIssues.map((issue) => `${issue.repoUrl}#${issue.number}`);
    setSelectedIssueKeys((prev) => {
      if (allVisibleSelected) {
        return prev.filter((key) => !visibleKeys.includes(key));
      }
      const merged = new Set([...prev, ...visibleKeys]);
      return Array.from(merged);
    });
  }, [allVisibleSelected, filteredIssues]);

  const runBulkAction = useCallback(async (action: 'comment' | 'close') => {
    if (selectedIssues.length === 0) return;
    if (!bulkCommentDraft.trim()) return;
    setBulkMutating(true);
    setError(null);
    setActionNotice(null);
    const successes: string[] = [];
    const failures: string[] = [];
    for (const issue of selectedIssues) {
      try {
        const updated = action === 'comment'
          ? await runIssueMutation(issue.repoUrl, (token) => commentGithubIssue(token, {
            repoUrl: issue.repoUrl,
            issueNumber: issue.number,
            comment: bulkCommentDraft.trim(),
          }))
          : await runIssueMutation(issue.repoUrl, (token) => closeGithubIssueWithComment(token, {
            repoUrl: issue.repoUrl,
            issueNumber: issue.number,
            comment: bulkCommentDraft.trim(),
          }));
        applyIssueUpdate({ ...updated, repoUrl: issue.repoUrl, projectName: issue.projectName, repoName: issue.repoName });
        successes.push(`#${issue.number}@${issue.repoName}`);
      } catch (e) {
        failures.push(`#${issue.number}@${issue.repoName} (${e instanceof Error ? e.message : 'Unknown error'})`);
      }
    }

    if (failures.length > 0) {
      setError(`Bulk ${action} partial failure: ${failures.join(' | ')}`);
    }
    if (successes.length > 0) {
      setActionNotice(
        action === 'comment'
          ? `Added comment to ${successes.length} issue(s).`
          : `Closed ${successes.length} issue(s).`,
      );
      if (action === 'close') {
        setSelectedIssueKeys([]);
      }
    }
    setBulkMutating(false);
  }, [applyIssueUpdate, bulkCommentDraft, runIssueMutation, selectedIssues]);

  // ── Render ───────────────────────────────────────────────────────────

  const syncDisabled = loading || repoTargets.length === 0;
  const syncLabel = hasToken === false ? 'Authorize GitHub' : loading ? 'Syncing...' : 'Sync Issues from GitHub';

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat title="Selected Projects" value={selectedProjectsCount} tone="sky" />
        <MiniStat title="Open Issues" value={openCount} tone="emerald" />
        <MiniStat title="Closed Issues" value={closedCount} tone="stone" />
        <MiniStat title="Total Issues" value={issues.length} tone="amber" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {perRepoCounts.map((repo) => {
          const sync = repoSyncState[repo.repoUrl];
          return (
            <div key={repo.repoUrl} className="rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/60 px-3 py-2">
              <p className="truncate text-xs font-medium text-stone-100">{repo.projectName}</p>
              <p className="truncate text-[10px] text-stone-400">{repo.repoName}</p>
              <p className="mt-1 text-[11px] text-stone-300">
                Open {repo.open} · Closed {repo.closed} · Total {repo.total}
              </p>
              {sync?.loading && <p className="text-[10px] text-sky-200">Syncing…</p>}
              {!sync?.loading && sync?.error && (
                <p className="line-clamp-1 text-[10px] text-red-200">Error: {sync.error}</p>
              )}
              {!sync?.loading && !sync?.error && sync?.syncedAt && (
                <p className="text-[10px] text-stone-400">Synced {relativeTime(new Date(sync.syncedAt).toISOString())}</p>
              )}
            </div>
          );
        })}
      </div>

      {repoTargets.length === 0 && (
        <div className="flex items-center gap-2 rounded border border-amber-200/20 bg-amber-500/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-300" />
          <p className="text-xs text-amber-100">
            No GitHub repository URL is configured for the selected project. Add the repo URL in Projects before syncing issues.
          </p>
        </div>
      )}

      <div className="rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-stone-300">Issue Actions</p>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            disabled={repoTargets.length === 0}
            className="flex items-center gap-1 rounded bg-emerald-600/25 px-2.5 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {createOpen ? 'Hide Create' : 'Create Issue'}
          </button>
        </div>

      {createOpen && (
        <div className="rounded border border-stone-200/15 bg-black/10 p-3">
          <div className="grid gap-2">
            <select
              value={createRepoUrl}
              onChange={(e) => setCreateRepoUrl(e.target.value)}
              className="rounded border border-stone-200/15 bg-transparent px-2.5 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-stone-200/40"
            >
              {repoTargets.map((repo) => (
                <option key={repo.repoUrl} value={repo.repoUrl}>
                  {repo.projectName} · {repo.repoName}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={createTitle}
              placeholder="New issue title"
              onChange={(e) => setCreateTitle(e.target.value)}
              className="rounded border border-stone-200/15 bg-transparent px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-stone-200/40"
            />
            <textarea
              value={createBody}
              placeholder="Issue description (optional)"
              onChange={(e) => setCreateBody(e.target.value)}
              rows={4}
              className="rounded border border-stone-200/15 bg-transparent px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-stone-200/40"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded px-2.5 py-1.5 text-[11px] text-stone-300 hover:text-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutating || !createTitle.trim()}
                onClick={handleCreateIssue}
                className="rounded bg-emerald-600/30 px-2.5 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-600/40 disabled:opacity-50"
              >
                {mutating ? 'Creating…' : 'Create and Sync'}
              </button>
            </div>
          </div>
        </div>
      )}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <textarea
            rows={3}
            value={bulkCommentDraft}
            placeholder="Bulk comment for selected issues"
            onChange={(e) => setBulkCommentDraft(e.target.value)}
            className="rounded border border-stone-200/15 bg-transparent px-2 py-1.5 text-xs text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-stone-200/40"
          />
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-stone-300">
              Selected issues: <span className="font-mono text-stone-100">{selectedIssues.length}</span>
            </p>
            <button
              type="button"
              disabled={bulkMutating || selectedIssues.length === 0 || !bulkCommentDraft.trim()}
              onClick={() => void runBulkAction('comment')}
              className="rounded bg-violet-600/25 px-2.5 py-1.5 text-[11px] text-violet-100 hover:bg-violet-600/35 disabled:opacity-50"
            >
              Add Comment to Selected
            </button>
            <button
              type="button"
              disabled={bulkMutating || selectedIssues.length === 0 || !bulkCommentDraft.trim()}
              onClick={() => void runBulkAction('close')}
              className="rounded bg-amber-600/25 px-2.5 py-1.5 text-[11px] text-amber-100 hover:bg-amber-600/35 disabled:opacity-50"
            >
              Close Selected with Comment
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70 px-3 py-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search issues…"
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            className="w-full rounded border border-stone-200/15 bg-transparent py-1.5 pl-8 pr-3 text-xs text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-stone-200/40"
          />
        </div>

        {/* State filter */}
        <select
          aria-label="State filter"
          value={filter.state}
          onChange={(e) => setFilter((f) => ({ ...f, state: e.target.value as FilterState['state'] }))}
          className="rounded border border-stone-200/15 bg-transparent px-2 py-1.5 text-xs text-stone-100 focus:outline-none"
        >
          <option value="all">All states</option>
          <option value="open">Open only</option>
          <option value="closed">Closed only</option>
        </select>

        <div className="flex items-center gap-1 border-l border-stone-200/15 pl-2">
          <Snowflake size={12} className="text-cyan-300" />
          <label className="text-[10px] text-stone-400">Freeze cols</label>
          <input
            type="number"
            min={0}
            max={5}
            value={issueFreezeCols}
            onChange={(e) => setIssueFreezeCols(Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
            className="h-6 w-10 border border-stone-200/15 bg-transparent px-1 text-center text-xs text-stone-100"
          />
          <label className="text-[10px] text-stone-400">Row h</label>
          <input
            type="number"
            min={32}
            max={160}
            value={issueRowHeight}
            onChange={(e) => setIssueRowHeight(Math.max(32, Math.min(160, Number(e.target.value) || 40)))}
            className="h-6 w-12 border border-stone-200/15 bg-transparent px-1 text-center text-xs text-stone-100"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowIssueHiddenCols((value) => !value)}
            className="inline-flex items-center gap-1 rounded border border-stone-200/15 px-2 py-1.5 text-[10px] text-stone-300 hover:text-stone-100"
          >
            <EyeOff size={12} /> Hidden cols ({hiddenIssueColumnIds.length})
          </button>
          {showIssueHiddenCols && (
            <div className="absolute right-0 top-8 z-40 w-56 border border-stone-200/20 bg-[rgb(var(--pm-rail))] p-2 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.12em] text-stone-400">Columns</p>
                <button type="button" onClick={() => setHiddenIssueColumnIds([])} className="text-[10px] text-cyan-200 hover:text-cyan-100">Show all</button>
              </div>
              {ISSUE_COLUMN_DEFS.map((column) => {
                const hidden = hiddenIssueColumnIds.includes(column.id);
                return (
                  <button
                    key={column.id}
                    type="button"
                    disabled={column.id === 'col-id'}
                    onClick={() => setHiddenIssueColumnIds((prev) => (
                      hidden ? prev.filter((id) => id !== column.id) : [...prev, column.id]
                    ))}
                    className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-[11px] text-stone-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-stone-500"
                  >
                    <span>{column.label}</span>
                    <span className="text-[10px] text-stone-500">{hidden ? 'Hidden' : 'Shown'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowIssueHiddenRowsMenu((value) => !value)}
            className={clsx(
              'inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px]',
              hiddenIssueRows.length > 0
                ? 'border-cyan-200/35 bg-cyan-500/10 text-cyan-100'
                : 'border-stone-200/15 text-stone-300 hover:text-stone-100',
            )}
          >
            <EyeOff size={12} /> Hidden rows ({hiddenIssueRows.length})
          </button>
          {showIssueHiddenRowsMenu && (
            <div className="absolute right-0 top-8 z-40 w-72 border border-stone-200/20 bg-[rgb(var(--pm-rail))] p-2 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.12em] text-stone-400">Hidden rows</p>
                {hiddenIssueRows.length > 0 && (
                  <button type="button" onClick={() => setHiddenIssueRowKeys([])} className="text-[10px] text-cyan-200 hover:text-cyan-100">Show all</button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowIssueHiddenRows((value) => !value)}
                className="mb-2 block w-full rounded border border-stone-200/15 px-2 py-1.5 text-left text-[11px] text-stone-200 hover:bg-white/10"
              >
                {showIssueHiddenRows ? 'Hide hidden rows from table' : 'Show hidden rows in table'}
              </button>
              {hiddenIssueRows.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-stone-500">No hidden rows.</p>
              ) : (
                <div className="max-h-60 overflow-auto">
                  {hiddenIssueRows.map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-2 py-1">
                      <span className="min-w-0 truncate text-[11px] text-stone-200" title={row.label}>
                        {row.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHiddenIssueRowKeys((prev) => prev.filter((key) => key !== row.key))}
                        className="rounded border border-cyan-200/30 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-500/10"
                      >
                        Show
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setFilter({ state: 'all', label: null, search: '' });
            setIssueSort(null);
            setIssueFreezeCols(0);
            setIssueRowHeight(40);
            setIssueColumnWidths(Object.fromEntries(ISSUE_COLUMN_DEFS.map((column) => [column.id, column.width])) as Record<IssueColumnId, number>);
            setHiddenIssueColumnIds([]);
            setHiddenIssueRowKeys([]);
            try { window.localStorage.removeItem(ISSUES_TABLE_PREFS_KEY); } catch {}
          }}
          className="inline-flex items-center gap-1 rounded border border-stone-200/15 px-2 py-1.5 text-[10px] text-stone-300 hover:text-stone-100"
        >
          <RotateCcw size={12} /> Reset view
        </button>

        <button
          type="button"
          onClick={toggleAllVisible}
          disabled={filteredIssues.length === 0}
          className="rounded border border-stone-200/15 px-2 py-1.5 text-[10px] text-stone-200 hover:bg-white/5 disabled:opacity-50"
        >
          {allVisibleSelected ? 'Unselect visible' : 'Select visible'}
        </button>

        {/* Label filter chips */}
        {allLabels.slice(0, 8).map((label) => (
          <button
            key={label}
            type="button"
            onClick={() =>
              setFilter((f) => ({
                ...f,
                label: f.label === label ? null : label,
              }))
            }
            className={clsx(
              'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
              filter.label === label
                ? 'bg-sky-600/60 text-white'
                : 'bg-stone-200/10 text-stone-300 hover:bg-stone-200/20',
            )}
          >
            {label}
          </button>
        ))}
        {allLabels.length > 8 && (
          <span className="text-[10px] text-stone-400">+{allLabels.length - 8}</span>
        )}

        {/* Clear filter */}
        {(filter.state !== 'all' || filter.label || filter.search) && (
          <button
            type="button"
            onClick={() => setFilter({ state: 'all', label: null, search: '' })}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-stone-400 hover:text-stone-200"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}

        <div className="flex-1" />

        {/* Sync button */}
        <button
          type="button"
          onClick={handleSyncAction}
          disabled={syncDisabled}
          title={hasToken === false ? 'Authorize GitHub before syncing issues' : 'Sync Issues from GitHub'}
          className={clsx(
            'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
            syncDisabled
              ? 'bg-stone-200/10 text-stone-400 cursor-not-allowed'
              : 'bg-sky-600/30 text-sky-100 hover:bg-sky-600/40',
          )}
        >
          {hasToken === false ? (
            <KeyRound className="h-3.5 w-3.5" />
          ) : (
            <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
          )}
          {syncLabel}
        </button>
      </div>

      {/* No-token guidance */}
      {hasToken === false && (
        <div className="flex items-center gap-2 rounded border border-amber-200/20 bg-amber-500/10 px-3 py-2">
          <KeyRound className="h-4 w-4 flex-shrink-0 text-amber-300" />
          <p className="text-xs text-amber-100">
            Authorize GitHub before syncing. Project Manager needs repo access to read issues, and issue write access when you create comments or close issues.
          </p>
          {isTauri() && GITHUB_PROVIDER && (
            <button
              type="button"
              onClick={() => setOauthOpen(true)}
              className="ml-auto rounded border border-amber-200/25 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-200/10"
            >
              Authorize
            </button>
          )}
        </div>
      )}

      {/* Error bar */}
      {error && (
        <div className="flex items-center gap-2 rounded border border-red-200/20 bg-red-500/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-300 flex-shrink-0" />
          <p className="text-xs text-red-100">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-red-300 hover:text-red-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {actionNotice && !error && (
        <div className="flex items-center gap-2 rounded border border-emerald-200/20 bg-emerald-500/10 px-3 py-2">
          <CheckCircle className="h-4 w-4 text-emerald-300 flex-shrink-0" />
          <p className="text-xs text-emerald-100">{actionNotice}</p>
        </div>
      )}

      {/* Sync info */}
      {Object.keys(syncedAt).length > 0 && !loading && (
        <p className="text-[10px] text-stone-400">
          Synced {Object.keys(syncedAt).length} repo(s) · {issues.length} issues
          {filteredIssues.length < issues.length && ` · ${filteredIssues.length} shown`}
        </p>
      )}

      {/* Content area: table + detail panel */}
      <div className="flex flex-col gap-3 xl:flex-row">
        {/* Issues table */}
        <div className={clsx('min-w-0', detailIssue ? 'w-full xl:flex-1' : 'w-full')}>
          {issues.length === 0 && !loading ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center justify-center rounded border border-dashed border-stone-200/15 py-8">
                <GitPullRequest className="h-8 w-8 text-stone-400 mb-2" />
                <p className="text-sm text-stone-400">
                  {hasToken === false
                    ? 'Authorize GitHub to sync issues'
                    : 'No issues synced yet. Click "Sync Issues from GitHub" to begin.'}
                </p>
              </div>
              <IssuesTable
                issues={[]}
                selectedIssueKey={null}
                onRowClick={handleRowClick}
                onDispatch={handleDispatch}
                selectedIssueKeys={selectedIssueKeys}
                onToggleSelect={toggleIssueSelection}
                dispatchDisabled={dispatching}
                sort={issueSort}
                onSortChange={setIssueSort}
                freezeCols={issueFreezeCols}
                rowHeight={issueRowHeight}
                columnWidths={issueColumnWidths}
                onColumnWidthsChange={setIssueColumnWidths}
                hiddenColumnIds={hiddenIssueColumnIds}
                onHiddenColumnIdsChange={setHiddenIssueColumnIds}
                hiddenRowKeys={hiddenIssueRowKeys}
                onHiddenRowKeysChange={setHiddenIssueRowKeys}
              />
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center justify-center rounded border border-dashed border-stone-200/15 py-8">
                <Search className="h-6 w-6 text-stone-400 mb-2" />
                <p className="text-sm text-stone-400">No issues match the current filters.</p>
              </div>
              <IssuesTable
                issues={[]}
                selectedIssueKey={null}
                onRowClick={handleRowClick}
                onDispatch={handleDispatch}
                selectedIssueKeys={selectedIssueKeys}
                onToggleSelect={toggleIssueSelection}
                dispatchDisabled={dispatching}
                sort={issueSort}
                onSortChange={setIssueSort}
                freezeCols={issueFreezeCols}
                rowHeight={issueRowHeight}
                columnWidths={issueColumnWidths}
                onColumnWidthsChange={setIssueColumnWidths}
                hiddenColumnIds={hiddenIssueColumnIds}
                onHiddenColumnIdsChange={setHiddenIssueColumnIds}
                hiddenRowKeys={hiddenIssueRowKeys}
                onHiddenRowKeysChange={setHiddenIssueRowKeys}
              />
            </div>
          ) : (
            <IssuesTable
              issues={filteredIssues}
              selectedIssueKey={detailIssue ? `${detailIssue.repoUrl}#${detailIssue.number}` : null}
              onRowClick={handleRowClick}
              onDispatch={handleDispatch}
              selectedIssueKeys={selectedIssueKeys}
              onToggleSelect={toggleIssueSelection}
              dispatchDisabled={dispatching}
              sort={issueSort}
              onSortChange={setIssueSort}
              freezeCols={issueFreezeCols}
              rowHeight={issueRowHeight}
              columnWidths={issueColumnWidths}
              onColumnWidthsChange={setIssueColumnWidths}
              hiddenColumnIds={hiddenIssueColumnIds}
              onHiddenColumnIdsChange={setHiddenIssueColumnIds}
              hiddenRowKeys={hiddenIssueRowKeys}
              onHiddenRowKeysChange={setHiddenIssueRowKeys}
            />
          )}
        </div>

        {/* Detail panel */}
        {detailIssue && (
          <div className="w-full flex-shrink-0 rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70 p-3 max-h-[50vh] overflow-y-auto xl:w-[24rem] xl:max-h-[60vh]">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <StatusBadge state={detailIssue.state} />
                <span className="text-xs text-stone-400">#{detailIssue.number}</span>
              </div>
              <button
                type="button"
                onClick={() => setDetailIssue(null)}
                className="text-stone-400 hover:text-stone-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <h3 className="text-sm font-medium text-stone-100 mb-2 leading-snug">
              {detailIssue.title}
            </h3>
            <p className="mb-2 text-[10px] text-stone-400">
              {detailIssue.projectName} · {detailIssue.repoName}
            </p>

            {/* Labels */}
            {detailIssue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {detailIssue.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-stone-200/10 px-2 py-0.5 text-[10px] text-stone-300"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Body (truncated) */}
            {detailIssue.body && (
              <div className="mb-2 max-h-40 overflow-y-auto">
                <p className="text-[11px] text-stone-300 leading-relaxed whitespace-pre-wrap">{detailIssue.body}</p>
              </div>
            )}

            {/* Meta */}
            <div className="space-y-1 mb-3">
              {detailIssue.user && (
                <p className="text-[10px] text-stone-400">Author: {detailIssue.user}</p>
              )}
              <p className="text-[10px] text-stone-400">
                Updated: {relativeTime(detailIssue.updatedAt)}
              </p>
            </div>

            <div className="mb-3 space-y-2 rounded border border-stone-200/10 bg-black/10 p-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-stone-400">
                <Pencil className="h-3 w-3" /> Update Issue
              </div>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded border border-stone-200/15 bg-transparent px-2 py-1.5 text-[11px] text-stone-100 focus:outline-none focus:border-stone-200/40"
              />
              <textarea
                rows={4}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full rounded border border-stone-200/15 bg-transparent px-2 py-1.5 text-[11px] text-stone-100 focus:outline-none focus:border-stone-200/40"
              />
              <button
                type="button"
                disabled={mutating}
                onClick={handleUpdateIssue}
                className="w-full rounded bg-cyan-600/25 px-2.5 py-1.5 text-[11px] text-cyan-100 hover:bg-cyan-600/35 disabled:opacity-50"
              >
                Save Update to GitHub
              </button>
            </div>

            <div className="mb-3 space-y-2 rounded border border-stone-200/10 bg-black/10 p-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-stone-400">
                <MessageSquarePlus className="h-3 w-3" /> Review / Close Comment
              </div>
              <textarea
                rows={3}
                value={commentDraft}
                placeholder="Add review feedback or close note"
                onChange={(e) => setCommentDraft(e.target.value)}
                className="w-full rounded border border-stone-200/15 bg-transparent px-2 py-1.5 text-[11px] text-stone-100 focus:outline-none focus:border-stone-200/40"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={mutating || !commentDraft.trim()}
                  onClick={handleCommentIssue}
                  className="flex-1 rounded bg-violet-600/25 px-2 py-1.5 text-[11px] text-violet-100 hover:bg-violet-600/35 disabled:opacity-50"
                >
                  Add Comment
                </button>
                <button
                  type="button"
                  disabled={mutating || detailIssue.state === 'closed'}
                  onClick={handleCloseWithComment}
                  className="flex-1 rounded bg-amber-600/25 px-2 py-1.5 text-[11px] text-amber-100 hover:bg-amber-600/35 disabled:opacity-50"
                >
                  Close with Comment
                </button>
                <button
                  type="button"
                  disabled={mutating || detailIssue.state === 'open'}
                  onClick={handleReopenWithComment}
                  className="flex-1 rounded bg-emerald-600/25 px-2 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-600/35 disabled:opacity-50"
                >
                  Reopen
                </button>
              </div>
            </div>

            <div className="mb-3 space-y-2 rounded border border-stone-200/10 bg-black/10 p-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-stone-400">
                <span>Review Timeline</span>
                {commentsLoading && <span className="text-[9px] text-sky-200">Loading…</span>}
              </div>
              {commentsError && (
                <p className="text-[10px] text-red-200">{commentsError}</p>
              )}
              {!commentsLoading && !commentsError && comments.length === 0 && (
                <p className="text-[10px] text-stone-500">No comments yet.</p>
              )}
              {!commentsLoading && comments.slice(0, 5).map((comment) => (
                <div key={comment.id} className="rounded border border-stone-200/10 px-2 py-1.5">
                  <p className="text-[10px] text-stone-400">
                    {comment.user ?? 'unknown'} · {relativeTime(comment.updatedAt)}
                  </p>
                  <p className="line-clamp-3 text-[11px] text-stone-200 whitespace-pre-wrap">{comment.body || '(empty)'}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <a
                href={detailIssue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded bg-stone-200/10 px-2.5 py-1.5 text-[11px] text-stone-300 hover:bg-stone-200/20"
              >
                <ExternalLink className="h-3 w-3" /> Open on GitHub
              </a>
              <button
                type="button"
                onClick={() => handleDispatch(detailIssue)}
                className="rounded bg-sky-600/30 px-2.5 py-1.5 text-[11px] text-sky-100 hover:bg-sky-600/40"
              >
                Dispatch
              </button>
            </div>
          </div>
        )}
      </div>
      {oauthOpen && GITHUB_PROVIDER && (
        <OAuthDeviceModal
          provider={GITHUB_PROVIDER}
          onClose={() => setOauthOpen(false)}
          onAuthorized={handleOAuthAuthorized}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStat({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: 'sky' | 'emerald' | 'amber' | 'stone';
}) {
  const toneClass = {
    sky: 'text-sky-100 bg-sky-600/15 border-sky-400/20',
    emerald: 'text-emerald-100 bg-emerald-600/15 border-emerald-400/20',
    amber: 'text-amber-100 bg-amber-600/15 border-amber-400/20',
    stone: 'text-stone-100 bg-stone-600/15 border-stone-400/20',
  }[tone];
  return (
    <div className={clsx('rounded border px-3 py-2', toneClass)}>
      <p className="text-[10px] uppercase tracking-[0.08em] opacity-80">{title}</p>
      <p className="text-base font-semibold leading-tight">{value}</p>
    </div>
  );
}

function StatusBadge({ state }: { state: 'open' | 'closed' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        state === 'open'
          ? 'bg-emerald-500/20 text-emerald-200'
          : 'bg-stone-200/15 text-stone-300',
      )}
    >
      {state === 'open' ? (
        <CheckCircle className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      {state}
    </span>
  );
}

// ── IssuesTable ───────────────────────────────────────────────────────────────

interface IssuesTableProps {
  issues: DetailIssue[];
  selectedIssueKey: string | null;
  selectedIssueKeys: string[];
  onRowClick: (issue: DetailIssue) => void;
  onDispatch: (issue: DetailIssue) => void;
  onToggleSelect: (issue: DetailIssue) => void;
  dispatchDisabled: boolean;
  sort: IssueSort;
  onSortChange: (sort: IssueSort) => void;
  freezeCols: number;
  rowHeight: number;
  columnWidths: Record<IssueColumnId, number>;
  onColumnWidthsChange: Dispatch<SetStateAction<Record<IssueColumnId, number>>>;
  hiddenColumnIds: IssueColumnId[];
  onHiddenColumnIdsChange: Dispatch<SetStateAction<IssueColumnId[]>>;
  hiddenRowKeys: string[];
  onHiddenRowKeysChange: Dispatch<SetStateAction<string[]>>;
}

function IssuesTable({
  issues,
  selectedIssueKey,
  selectedIssueKeys,
  onRowClick,
  onDispatch,
  onToggleSelect,
  dispatchDisabled,
  sort,
  onSortChange,
  freezeCols,
  rowHeight,
  columnWidths,
  onColumnWidthsChange,
  hiddenColumnIds,
  onHiddenColumnIdsChange,
  hiddenRowKeys,
  onHiddenRowKeysChange,
}: IssuesTableProps) {
  const resizePrompt = useInAppPrompt();
  const visibleColumns = ISSUE_COLUMN_DEFS.filter((column) => !hiddenColumnIds.includes(column.id) || column.id === 'col-id');
  const leftOffsets = visibleColumns.reduce<Record<IssueColumnId, number>>((acc, column, index) => {
    const previous = visibleColumns[index - 1];
    acc[column.id] = previous ? acc[previous.id] + (columnWidths[previous.id] ?? previous.width) : 0;
    return acc;
  }, {} as Record<IssueColumnId, number>);
  const frozenCount = Math.max(0, Math.min(visibleColumns.length, freezeCols));
  const toggleSort = (column: (typeof ISSUE_COLUMN_DEFS)[number]) => {
    if (!column.sortable) return;
    if (!sort || sort.columnId !== column.id) {
      onSortChange({ columnId: column.id, direction: 'asc' });
      return;
    }
    if (sort.direction === 'asc') {
      onSortChange({ columnId: column.id, direction: 'desc' });
      return;
    }
    onSortChange(null);
  };
  const renderCell = (columnId: IssueColumnId, issue: DetailIssue) => {
    switch (columnId) {
      case 'col-select':
        return (
          <input
            type="checkbox"
            aria-label={`Select issue #${issue.number}`}
            checked={selectedIssueKeys.includes(`${issue.repoUrl}#${issue.number}`)}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(issue);
            }}
          />
        );
      case 'col-id':
        return (
          <span
            className="block max-w-[160px] truncate font-mono text-[11px] text-stone-300"
            title={`${issueRowUuid(issue)} · ${issue.repoUrl}#${issue.number}`}
          >
            {issueRowUuid(issue)}
          </span>
        );
      case 'col-issue-number':
        return <span className="font-mono text-stone-300">#{issue.number}</span>;
      case 'col-project':
        return <span className="text-[11px] text-stone-400">{issue.projectName}</span>;
      case 'col-title':
        return <span className="block max-w-xs truncate text-stone-100">{issue.title}</span>;
      case 'col-status':
        return <StatusBadge state={issue.state} />;
      case 'col-labels':
        return (
          <div className="flex flex-wrap gap-1">
            {issue.labels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="rounded-full bg-stone-200/10 px-1.5 py-0.5 text-[9px] text-stone-300"
              >
                {label}
              </span>
            ))}
            {issue.labels.length > 3 && (
              <span className="text-[9px] text-stone-400">+{issue.labels.length - 3}</span>
            )}
          </div>
        );
      case 'col-updated':
        return <span className="text-[11px] text-stone-400">{relativeTime(issue.updatedAt)}</span>;
      case 'col-actions':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDispatch(issue);
            }}
            disabled={dispatchDisabled}
            className="rounded bg-sky-600/25 px-2 py-1 text-[10px] text-sky-100 hover:bg-sky-600/40 disabled:opacity-50"
          >
            Dispatch
          </button>
        );
      default:
        return null;
    }
  };
  return (
    <div className="pm-scroll relative max-h-[55vh] overflow-auto border border-stone-200/15 bg-[rgb(var(--pm-rail))]/70">
      <table
        className="w-full table-fixed border-collapse text-left"
        style={{ minWidth: visibleColumns.reduce((sum, column) => sum + (columnWidths[column.id] ?? column.width), 0) }}
      >
        <thead className="sticky top-0 z-40 bg-[rgb(var(--pm-rail))]">
          <tr>
            {visibleColumns.map((column, index) => {
              const isFrozen = index < frozenCount;
              const sorted = sort?.columnId === column.id ? sort.direction : null;
              return (
                <TH
                  key={column.id}
                  className="relative overflow-hidden"
                  style={{
                    width: columnWidths[column.id] ?? column.width,
                    minWidth: columnWidths[column.id] ?? column.width,
                    position: isFrozen ? 'sticky' : undefined,
                    left: isFrozen ? leftOffsets[column.id] : undefined,
                    zIndex: isFrozen ? 50 : undefined,
                    background: 'rgb(var(--pm-rail))',
                  }}
                  onClick={() => toggleSort(column)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    void (async () => {
                      const raw = await resizePrompt.open({
                        title: 'Resize column',
                        message: 'Resize column width in px. Enter 0 to hide this column.',
                        defaultValue: String(columnWidths[column.id] ?? column.width),
                      });
                      if (raw == null) return;
                      const value = Number(raw);
                      if (!Number.isFinite(value)) return;
                      if (value === 0) {
                        if (column.id !== 'col-id') onHiddenColumnIdsChange((prev) => Array.from(new Set([...prev, column.id])));
                        return;
                      }
                      onColumnWidthsChange((prev) => ({ ...prev, [column.id]: Math.max(56, Math.min(640, value)) }));
                    })();
                  }}
                >
                  <span className={clsx('inline-flex items-center gap-1', column.sortable && 'cursor-pointer hover:text-stone-200')}>
                    {column.label}
                    {column.sortable && <span className="text-[10px] text-stone-500">{sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}</span>}
                  </span>
                </TH>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr
              key={`${issue.repoUrl}#${issue.number}`}
              onClick={() => onRowClick(issue)}
              onContextMenu={(e) => {
                e.preventDefault();
                const key = `${issue.repoUrl}#${issue.number}`;
                onHiddenRowKeysChange((prev) => (
                  prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
                ));
              }}
              className={clsx(
                'border-t border-stone-200/10 cursor-pointer transition-colors',
                hiddenRowKeys.includes(`${issue.repoUrl}#${issue.number}`) && 'opacity-60',
                selectedIssueKey === `${issue.repoUrl}#${issue.number}`
                  ? 'bg-sky-600/15'
                  : 'hover:bg-white/5',
              )}
            >
              {visibleColumns.map((column, index) => {
                const isFrozen = index < frozenCount;
                return (
                  <TD
                    key={column.id}
                    style={{
                      width: columnWidths[column.id] ?? column.width,
                      minWidth: columnWidths[column.id] ?? column.width,
                      height: rowHeight,
                      position: isFrozen ? 'sticky' : undefined,
                      left: isFrozen ? leftOffsets[column.id] : undefined,
                      zIndex: isFrozen ? 20 : undefined,
                      background: isFrozen ? 'rgb(var(--pm-rail))' : undefined,
                    }}
                  >
                    {renderCell(column.id, issue)}
                  </TD>
                );
              })}
            </tr>
          ))}
          {issues.length === 0 && (
            <tr>
              <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-xs text-stone-500">
                No rows match the current search or filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {resizePrompt.dialog}
    </div>
  );
}

function TH({
  className,
  children,
  style,
  onClick,
  onContextMenu,
}: {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  onContextMenu?: (event: MouseEvent) => void;
}) {
  return (
    <th
      className={clsx('overflow-hidden px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400', className)}
      style={style}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </th>
  );
}

function TD({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <td className={clsx('overflow-hidden px-3 py-2 text-xs', className)} style={style}>
      {children}
    </td>
  );
}
