'use client';

import { FolderKanban, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { WorkspaceRole } from '../../lib/auth/permissions';
import {
  formatProjectOverallStatusLabel,
  formatProjectProgressSummaryLine,
  listPortalProjectProgress,
  type PortalProjectProgressSummary,
} from '../../lib/auth/portalProjectProgress';

interface PortalProjectsPanelProps {
  workspaceRole: WorkspaceRole | null;
  workspaceId: string | null;
}

export function PortalProjectsPanel({ workspaceRole, workspaceId }: PortalProjectsPanelProps) {
  const [summaries, setSummaries] = useState<PortalProjectProgressSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummaries() {
      if (!workspaceRole || !workspaceId) {
        setSummaries([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await listPortalProjectProgress(workspaceId);
      if (cancelled) return;

      setSummaries(result.summaries);
      setError(result.error);
      setLoading(false);
    }

    void loadSummaries();
    return () => {
      cancelled = true;
    };
  }, [workspaceRole, workspaceId]);

  if (!workspaceRole) {
    return null;
  }

  return (
    <section className="rounded border border-stone-200/15 bg-stone-100/5 p-4">
      <div className="flex items-center gap-2">
        <FolderKanban size={16} className="text-amber-100" />
        <h2 className="text-sm font-semibold text-stone-100">Project progress</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-400">
        Workspace project summaries derived from cloud feature metadata. Detailed progress sheets
        remain in project files until sync writeback lands.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 size={14} className="animate-spin" />
          Loading project progress…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
          {error}
        </p>
      ) : null}

      {!loading && !error && summaries.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">No projects are visible for this workspace yet.</p>
      ) : null}

      {!loading && !error && summaries.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {summaries.map((summary) => (
            <li
              key={summary.projectId}
              className="rounded border border-stone-200/15 bg-stone-950/30 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium text-stone-100">{summary.projectName}</h3>
                <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
                  {formatProjectOverallStatusLabel(summary.overallStatus)}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-stone-400">
                {formatProjectProgressSummaryLine(summary)}
              </p>
              {summary.averageProgressPercent !== null ? (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded bg-stone-800">
                    <div
                      className="h-full rounded bg-emerald-400/80"
                      style={{ width: `${Math.min(summary.averageProgressPercent, 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <p className="mt-2 text-xs text-stone-500">
                Added {new Date(summary.createdAt).toLocaleDateString()}
                {summary.lastFeatureUpdatedAt
                  ? ` · Features updated ${new Date(summary.lastFeatureUpdatedAt).toLocaleString()}`
                  : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
