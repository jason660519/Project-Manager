'use client';

import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  formatReportTypeLabel,
  listPortalReports,
  type PortalReport,
} from '../../lib/auth/reportMetadata';
import type { WorkspaceRole } from '../../lib/auth/permissions';
import { canReadDraftReports } from '../../lib/supabase/rlsContracts';

interface PortalReportsPanelProps {
  workspaceRole: WorkspaceRole | null;
  workspaceId: string | null;
}

export function PortalReportsPanel({ workspaceRole, workspaceId }: PortalReportsPanelProps) {
  const [reports, setReports] = useState<PortalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      if (!workspaceRole || !workspaceId) {
        setReports([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await listPortalReports(undefined, workspaceId);
      if (cancelled) return;

      setReports(result.reports);
      setError(result.error);
      setLoading(false);
    }

    void loadReports();
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
        <FileText size={16} className="text-amber-100" />
        <h2 className="text-sm font-semibold text-stone-100">Published reports</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-400">
        Delivery summaries and milestones from workspace report metadata. Report bodies open from
        linked URLs or storage paths — not from Postgres rows.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 size={14} className="animate-spin" />
          Loading reports…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
          {error}
        </p>
      ) : null}

      {!loading && !error && reports.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">No reports are visible for your workspace role yet.</p>
      ) : null}

      {!loading && !error && reports.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded border border-stone-200/15 bg-stone-950/30 px-3 py-3"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-stone-100">{report.title}</h3>
                    <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
                      {formatReportTypeLabel(report.reportType)}
                    </span>
                    {canReadDraftReports(workspaceRole) && report.status !== 'published' ? (
                      <span className="rounded border border-amber-200/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-100">
                        {report.status}
                      </span>
                    ) : null}
                  </div>
                  {report.projectName ? (
                    <p className="mt-1 text-xs text-stone-500">Project: {report.projectName}</p>
                  ) : null}
                  {report.summary ? (
                    <p className="mt-2 text-xs leading-5 text-stone-400">{report.summary}</p>
                  ) : null}
                </div>

                {report.contentUrl ? (
                  <a
                    href={report.contentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                  >
                    Open report
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="text-xs text-stone-500">Link pending</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
