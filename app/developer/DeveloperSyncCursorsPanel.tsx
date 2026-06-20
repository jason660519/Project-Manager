'use client';

import { GitCompareArrows, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  formatSyncResourceTypeLabel,
  formatSyncStatusLabel,
  listSyncCursors,
  type DeveloperSyncCursor,
} from '../../lib/auth/syncCursors';
import type { WorkspaceRole } from '../../lib/auth/permissions';
import { canReadSyncCursors } from '../../lib/supabase/rlsContracts';

interface DeveloperSyncCursorsPanelProps {
  workspaceRole: WorkspaceRole | null;
  workspaceId: string | null;
}

export function DeveloperSyncCursorsPanel({
  workspaceRole,
  workspaceId,
}: DeveloperSyncCursorsPanelProps) {
  const [cursors, setCursors] = useState<DeveloperSyncCursor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCursors() {
      if (!workspaceRole || !workspaceId || !canReadSyncCursors(workspaceRole)) {
        setCursors([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await listSyncCursors(undefined, workspaceId);
      if (cancelled) return;

      setCursors(result.cursors);
      setError(result.error);
      setLoading(false);
    }

    void loadCursors();
    return () => {
      cancelled = true;
    };
  }, [workspaceRole, workspaceId]);

  if (!workspaceRole || !canReadSyncCursors(workspaceRole)) {
    return null;
  }

  return (
    <section className="rounded border border-stone-200/15 bg-stone-100/5 p-4">
      <div className="flex items-center gap-2">
        <GitCompareArrows size={16} className="text-amber-100" />
        <h2 className="text-sm font-semibold text-stone-100">Cloud Sync Cursors</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-400">
        Revision pointers for local/cloud writeback. Payloads stay in Git and the desktop runner.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 size={14} className="animate-spin" />
          Loading sync cursors…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
          {error}
        </p>
      ) : null}

      {!loading && !error && cursors.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">No sync cursors are registered for this workspace.</p>
      ) : null}

      {!loading && !error && cursors.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {cursors.map((cursor) => (
            <li
              key={cursor.id}
              className="rounded border border-stone-200/15 bg-stone-950/30 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium text-stone-100">{cursor.resourceKey}</h3>
                <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
                  {formatSyncResourceTypeLabel(cursor.resourceType)}
                </span>
                <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
                  {formatSyncStatusLabel(cursor.syncStatus)}
                </span>
              </div>
              {cursor.projectName ? (
                <p className="mt-1 text-xs text-stone-400">Project: {cursor.projectName}</p>
              ) : null}
              <div className="mt-2 grid gap-1 text-xs text-stone-500 sm:grid-cols-2">
                <p>Local revision: {cursor.localRevision ?? '—'}</p>
                <p>Cloud revision: {cursor.cloudRevision ?? '—'}</p>
              </div>
              {cursor.lastSyncedAt ? (
                <p className="mt-1 text-xs text-stone-500">
                  Last synced {new Date(cursor.lastSyncedAt).toLocaleString()}
                </p>
              ) : (
                <p className="mt-1 text-xs text-stone-500">
                  Updated {new Date(cursor.updatedAt).toLocaleString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
