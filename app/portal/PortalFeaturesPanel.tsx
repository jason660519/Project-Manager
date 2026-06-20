'use client';

import { ExternalLink, ListChecks, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  formatFeatureStatusLabel,
  listPortalFeatures,
  type PortalFeature,
} from '../../lib/auth/portalFeatures';
import type { WorkspaceRole } from '../../lib/auth/permissions';

interface PortalFeaturesPanelProps {
  workspaceRole: WorkspaceRole | null;
  workspaceId: string | null;
}

export function PortalFeaturesPanel({ workspaceRole, workspaceId }: PortalFeaturesPanelProps) {
  const [features, setFeatures] = useState<PortalFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFeatures() {
      if (!workspaceRole || !workspaceId) {
        setFeatures([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await listPortalFeatures(undefined, workspaceId);
      if (cancelled) return;

      setFeatures(result.features);
      setError(result.error);
      setLoading(false);
    }

    void loadFeatures();
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
        <ListChecks size={16} className="text-amber-100" />
        <h2 className="text-sm font-semibold text-stone-100">Feature progress</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-400">
        Cloud feature metadata for your workspace. Full progress sheets and specs remain in project
        files until sync writeback lands.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 size={14} className="animate-spin" />
          Loading features…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
          {error}
        </p>
      ) : null}

      {!loading && !error && features.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">No features are visible for this workspace yet.</p>
      ) : null}

      {!loading && !error && features.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {features.map((feature) => (
            <li
              key={feature.id}
              className="flex flex-col gap-2 rounded border border-stone-200/15 bg-stone-950/30 px-3 py-3 md:flex-row md:items-start md:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-stone-100">{feature.title}</h3>
                  <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
                    {formatFeatureStatusLabel(feature.status)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-stone-500">{feature.featureKey}</p>
                {feature.projectName ? (
                  <p className="mt-1 text-xs text-stone-500">Project: {feature.projectName}</p>
                ) : null}
                {feature.progressPercent !== null ? (
                  <p className="mt-1 text-xs text-stone-400">
                    Progress: {feature.progressPercent.toFixed(0)}%
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-stone-500">
                  Updated {new Date(feature.updatedAt).toLocaleString()}
                </p>
              </div>

              {feature.solutionDetailUrl ? (
                <a
                  href={feature.solutionDetailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                >
                  Open feature detail
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
