'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  GitPullRequest,
  MessageSquarePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { AnyAdapterConfig, EngineerRole, GithubIssue, IDEId } from '../../../lib/types';
import {
  fetchGithubIssueComments,
  closeGithubIssueWithComment,
  commentGithubIssue,
  createGithubIssue,
  fetchGithubIssues,
  getGithubToken,
  reopenGithubIssueWithComment,
  updateGithubIssue,
  type GithubIssueCommentPayload,
} from '../../../lib/bridge';

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

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

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

  const initialized = useRef(false);
  const effectiveRepoUrl = (repoUrl ?? '').trim() || 'https://github.com/jason66x/Project-Manager';
  const repoTargets = useMemo<RepoTarget[]>(() => {
    const fromSelected = selectedProjects
      .map((project) => {
        const url = (project.repoUrl ?? '').trim();
        if (!url) return null;
        const segments = url.replace(/\/+$/, '').split('/');
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

    const fallbackSegments = effectiveRepoUrl.replace(/\/+$/, '').split('/');
    return [{
      repoUrl: effectiveRepoUrl,
      projectName,
      repoName: fallbackSegments.slice(-2).join('/'),
    }];
  }, [selectedProjects, effectiveRepoUrl, projectName]);

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
            nextRepoState[failedRepo.repoUrl] = {
              loading: false,
              error: reason,
              syncedAt: repoSyncState[failedRepo.repoUrl]?.syncedAt ?? null,
            };
            errors.push(`${failedRepo.repoName}: ${reason}`);
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
      setError(e instanceof Error ? e.message : 'Sync failed');
      setRepoSyncState((prev) => {
        const next = { ...prev };
        repoTargets.forEach((repo) => {
          next[repo.repoUrl] = {
            loading: false,
            error: e instanceof Error ? e.message : 'Sync failed',
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
        i.projectName.toLowerCase().includes(q) ||
        i.repoName.toLowerCase().includes(q),
      );
    }

    return result;
  }, [issues, filter]);

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
  const allVisibleSelected = filteredIssues.length > 0
    && filteredIssues.every((issue) => selectedIssueKeys.includes(`${issue.repoUrl}#${issue.number}`));

  const handleRowClick = useCallback((issue: DetailIssue) => {
    setDetailIssue((prev) =>
      prev?.number === issue.number ? null : issue,
    );
  }, []);

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

  const syncDisabled = loading || hasToken === false;

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

      <div className="rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-stone-300">Issue Actions</p>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="flex items-center gap-1 rounded bg-emerald-600/25 px-2.5 py-1.5 text-[11px] text-emerald-100 hover:bg-emerald-600/35"
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
          onClick={onSync}
          disabled={syncDisabled}
          title={hasToken === false ? 'Configure GitHub token in Keys view → Sync Issues' : 'Sync Issues from GitHub'}
          className={clsx(
            'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
            syncDisabled
              ? 'bg-stone-200/10 text-stone-400 cursor-not-allowed'
              : 'bg-sky-600/30 text-sky-100 hover:bg-sky-600/40',
          )}
        >
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
          {loading ? 'Syncing…' : 'Sync Issues from GitHub'}
        </button>
      </div>

      {/* No-token guidance */}
      {hasToken === false && issues.length === 0 && (
        <div className="flex items-center gap-2 rounded border border-amber-200/20 bg-amber-500/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-amber-300 flex-shrink-0" />
          <p className="text-xs text-amber-100">
            Configure GitHub token in Keys view → Sync Issues.
          </p>
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
      <div className="flex gap-3">
        {/* Issues table */}
        <div className={clsx('min-w-0', detailIssue ? 'flex-1' : 'w-full')}>
          {issues.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center rounded border border-dashed border-stone-200/15 py-12">
              <GitPullRequest className="h-8 w-8 text-stone-400 mb-2" />
              <p className="text-sm text-stone-400">
                {hasToken === false
                  ? 'Configure your GitHub token to sync issues'
                  : 'No issues synced yet. Click "Sync Issues from GitHub" to begin.'}
              </p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded border border-dashed border-stone-200/15 py-8">
              <Search className="h-6 w-6 text-stone-400 mb-2" />
              <p className="text-sm text-stone-400">No issues match the current filters.</p>
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
            />
          )}
        </div>

        {/* Detail panel */}
        {detailIssue && (
          <div className="w-80 flex-shrink-0 rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70 p-3 overflow-y-auto max-h-[60vh]">
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
}

function IssuesTable({
  issues,
  selectedIssueKey,
  selectedIssueKeys,
  onRowClick,
  onDispatch,
  onToggleSelect,
  dispatchDisabled,
}: IssuesTableProps) {
  return (
    <div className="relative max-h-[55vh] overflow-auto border border-stone-200/15 bg-[rgb(var(--pm-rail))]/70">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-[rgb(var(--pm-rail))]">
          <tr>
            <TH className="w-10">Sel</TH>
            <TH className="w-16">#</TH>
            <TH className="w-32">Project</TH>
            <TH>Title</TH>
            <TH className="w-20">State</TH>
            <TH className="w-40">Labels</TH>
            <TH className="w-24">Updated</TH>
            <TH className="w-20">Action</TH>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr
              key={`${issue.repoUrl}#${issue.number}`}
              onClick={() => onRowClick(issue)}
              className={clsx(
                'border-t border-stone-200/10 cursor-pointer transition-colors',
                selectedIssueKey === `${issue.repoUrl}#${issue.number}`
                  ? 'bg-sky-600/15'
                  : 'hover:bg-white/5',
              )}
            >
              <TD>
                <input
                  type="checkbox"
                  checked={selectedIssueKeys.includes(`${issue.repoUrl}#${issue.number}`)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelect(issue);
                  }}
                />
              </TD>
              <TD className="font-mono text-stone-300">#{issue.number}</TD>
              <TD className="text-[11px] text-stone-400">{issue.projectName}</TD>
              <TD className="max-w-xs truncate text-stone-100">{issue.title}</TD>
              <TD><StatusBadge state={issue.state} /></TD>
              <TD>
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
              </TD>
              <TD className="text-[11px] text-stone-400">{relativeTime(issue.updatedAt)}</TD>
              <TD>
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
              </TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TH({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={clsx('px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400', className)}>
      {children}
    </th>
  );
}

function TD({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <td className={clsx('px-3 py-2 text-xs', className)}>
      {children}
    </td>
  );
}
