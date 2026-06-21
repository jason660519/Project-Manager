'use client';

import { Cpu, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  formatRunnerStatusLabel,
  listRunnerDevices,
  type DeveloperRunnerDevice,
} from '../../lib/auth/runnerDevices';
import type { WorkspaceRole } from '../../lib/auth/permissions';
import { canReadRunnerDevices } from '../../lib/supabase/rlsContracts';

interface DeveloperRunnersPanelProps {
  workspaceRole: WorkspaceRole | null;
  workspaceId: string | null;
}

export function DeveloperRunnersPanel({ workspaceRole, workspaceId }: DeveloperRunnersPanelProps) {
  const [runners, setRunners] = useState<DeveloperRunnerDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRunners() {
      if (!workspaceRole || !workspaceId || !canReadRunnerDevices(workspaceRole)) {
        setRunners([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await listRunnerDevices(undefined, workspaceId);
      if (cancelled) return;

      setRunners(result.runners);
      setError(result.error);
      setLoading(false);
    }

    void loadRunners();
    return () => {
      cancelled = true;
    };
  }, [workspaceRole, workspaceId]);

  if (!workspaceRole || !canReadRunnerDevices(workspaceRole)) {
    return null;
  }

  return (
    <section className="rounded border border-stone-200/15 bg-stone-100/5 p-4">
      <div className="flex items-center gap-2">
        <Cpu size={16} className="text-amber-100" />
        <h2 className="text-sm font-semibold text-stone-100">Paired Developer Runners</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-400">
        Cloud pairing metadata only. Runner tokens stay in the local OS Keychain.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 size={14} className="animate-spin" />
          Loading runners…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
          {error}
        </p>
      ) : null}

      {!loading && !error && runners.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">No paired runners are registered for this workspace.</p>
      ) : null}

      {!loading && !error && runners.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {runners.map((runner) => (
            <li
              key={runner.id}
              className="rounded border border-stone-200/15 bg-stone-950/30 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium text-stone-100">
                  {runner.deviceLabel ?? runner.runnerId}
                </h3>
                <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
                  {formatRunnerStatusLabel(runner.status)}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-stone-500">{runner.runnerId}</p>
              {runner.approvedProjectRoot ? (
                <p className="mt-2 text-xs text-stone-400">
                  Approved root: {runner.approvedProjectRoot}
                </p>
              ) : null}
              {runner.lastSeenAt ? (
                <p className="mt-1 text-xs text-stone-500">
                  Last seen {new Date(runner.lastSeenAt).toLocaleString()}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
