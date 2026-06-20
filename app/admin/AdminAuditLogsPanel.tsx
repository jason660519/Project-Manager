'use client';

import { Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  formatAuditActionLabel,
  formatAuditMetadataPreview,
  listAuditLogs,
  type AdminAuditLogEntry,
} from '../../lib/auth/auditLogs';
import type { WorkspaceRole } from '../../lib/auth/permissions';
import { canReadAuditLogs } from '../../lib/supabase/rlsContracts';

interface AdminAuditLogsPanelProps {
  workspaceRole: WorkspaceRole | null;
  workspaceId: string | null;
}

export function AdminAuditLogsPanel({ workspaceRole, workspaceId }: AdminAuditLogsPanelProps) {
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAuditLogs() {
      if (!workspaceRole || !workspaceId || !canReadAuditLogs(workspaceRole)) {
        setEntries([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await listAuditLogs(undefined, workspaceId);
      if (cancelled) return;

      setEntries(result.entries);
      setError(result.error);
      setLoading(false);
    }

    void loadAuditLogs();
    return () => {
      cancelled = true;
    };
  }, [workspaceRole, workspaceId]);

  if (!workspaceRole || !canReadAuditLogs(workspaceRole)) {
    return null;
  }

  return (
    <section className="rounded border border-stone-200/15 bg-stone-100/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} className="text-amber-100" />
        <h2 className="text-sm font-semibold text-stone-100">Audit history</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-400">
        Workspace access and operational events visible to Owner and Admin roles only.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 size={14} className="animate-spin" />
          Loading audit history…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
          {error}
        </p>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">No audit events are recorded for this workspace yet.</p>
      ) : null}

      {!loading && !error && entries.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {entries.map((entry) => {
            const metadataPreview = formatAuditMetadataPreview(entry.metadata, {
              action: entry.action,
              resourceType: entry.resourceType,
            });

            return (
              <li
                key={entry.id}
                className="rounded border border-stone-200/15 bg-stone-950/30 px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-stone-100">
                    {formatAuditActionLabel(entry.action)}
                  </h3>
                  <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
                    {entry.resourceType}
                  </span>
                </div>
                {entry.resourceId ? (
                  <p className="mt-1 font-mono text-xs text-stone-500">Resource: {entry.resourceId}</p>
                ) : null}
                {entry.actorUserId ? (
                  <p className="mt-1 font-mono text-xs text-stone-500">Actor: {entry.actorUserId}</p>
                ) : null}
                {metadataPreview ? (
                  <p className="mt-2 break-all text-xs leading-5 text-stone-400">{metadataPreview}</p>
                ) : null}
                <p className="mt-1 text-xs text-stone-500">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
