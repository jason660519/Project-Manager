'use client';

import { ExternalLink, Lightbulb, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceRole } from '../../lib/auth/permissions';
import { listPortalProjects, type PortalProject } from '../../lib/auth/portalProjects';

interface PortalSolutionsPanelProps {
  workspaceRole: WorkspaceRole | null;
  workspaceId: string | null;
}

export function PortalSolutionsPanel({ workspaceRole, workspaceId }: PortalSolutionsPanelProps) {
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      if (!workspaceRole || !workspaceId) {
        setProjects([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await listPortalProjects(undefined, workspaceId);
      if (cancelled) return;

      setProjects(result.projects);
      setError(result.error);
      setLoading(false);
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [workspaceRole, workspaceId]);

  const solutions = useMemo(
    () => projects.filter((project) => project.solutionDetailUrl),
    [projects],
  );

  if (!workspaceRole) {
    return null;
  }

  return (
    <section className="rounded border border-stone-200/15 bg-stone-100/5 p-4">
      <div className="flex items-center gap-2">
        <Lightbulb size={16} className="text-amber-100" />
        <h2 className="text-sm font-semibold text-stone-100">Solution detail pages</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-400">
        Published solution detail and flow URLs from cloud project metadata.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 size={14} className="animate-spin" />
          Loading solution links…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
          {error}
        </p>
      ) : null}

      {!loading && !error && solutions.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">
          No solution detail URLs are published for visible projects yet.
        </p>
      ) : null}

      {!loading && !error && solutions.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {solutions.map((project) => (
            <li
              key={project.id}
              className="flex flex-col gap-2 rounded border border-stone-200/15 bg-stone-950/30 px-3 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h3 className="text-sm font-medium text-stone-100">{project.name}</h3>
                <p className="mt-1 text-xs text-stone-500">Solution detail & flow URL</p>
              </div>
              {project.solutionDetailUrl ? (
                <a
                  href={project.solutionDetailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                >
                  Open solution page
                  <ExternalLink size={12} />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
