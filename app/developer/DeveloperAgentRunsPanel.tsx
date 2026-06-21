'use client';

import { Loader2, PlayCircle, ScrollText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  formatAgentRunStatusLabel,
  isDispatchQueueStatus,
  listAgentRuns,
  type DeveloperAgentRun,
} from '../../lib/auth/agentRuns';
import { roleHasCapability, type WorkspaceRole } from '../../lib/auth/permissions';

interface DeveloperAgentRunsPanelProps {
  workspaceRole: WorkspaceRole | null;
  workspaceId: string | null;
}

function AgentRunListItem({ run }: { run: DeveloperAgentRun }) {
  return (
    <li className="rounded border border-stone-200/15 bg-stone-950/30 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-stone-100">
          {run.projectName ?? 'Workspace run'}
        </h3>
        <span className="rounded border border-stone-200/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-stone-400">
          {formatAgentRunStatusLabel(run.status)}
        </span>
      </div>
      {run.runnerId ? (
        <p className="mt-1 font-mono text-xs text-stone-500">Runner: {run.runnerId}</p>
      ) : null}
      {run.summary ? (
        <p className="mt-2 text-xs leading-5 text-stone-400">{run.summary}</p>
      ) : null}
      <p className="mt-1 text-xs text-stone-500">
        Created {new Date(run.createdAt).toLocaleString()}
      </p>
    </li>
  );
}

export function DeveloperAgentRunsPanel({
  workspaceRole,
  workspaceId,
}: DeveloperAgentRunsPanelProps) {
  const [runs, setRuns] = useState<DeveloperAgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      if (!workspaceRole || !workspaceId || !roleHasCapability(workspaceRole, 'view:developer-console')) {
        setRuns([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await listAgentRuns(undefined, workspaceId);
      if (cancelled) return;

      setRuns(result.runs);
      setError(result.error);
      setLoading(false);
    }

    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [workspaceRole, workspaceId]);

  const dispatchQueue = useMemo(
    () => runs.filter((run) => isDispatchQueueStatus(run.status)),
    [runs],
  );
  const executionLogs = useMemo(
    () => runs.filter((run) => !isDispatchQueueStatus(run.status)),
    [runs],
  );

  if (!workspaceRole || !roleHasCapability(workspaceRole, 'view:developer-console')) {
    return null;
  }

  const canDispatch = roleHasCapability(workspaceRole, 'agent:dispatch');

  return (
    <div className="grid gap-4">
      <section className="rounded border border-stone-200/15 bg-stone-100/5 p-4">
        <div className="flex items-center gap-2">
          <PlayCircle size={16} className="text-amber-100" />
          <h2 className="text-sm font-semibold text-stone-100">Dispatch queue</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-stone-400">
          {canDispatch
            ? 'Queued and in-flight agent runs awaiting or undergoing local execution.'
            : 'Dispatch visibility requires Developer permission.'}
        </p>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
            <Loader2 size={14} className="animate-spin" />
            Loading dispatch queue…
          </div>
        ) : null}

        {!loading && error ? (
          <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
            {error}
          </p>
        ) : null}

        {!loading && !error && dispatchQueue.length === 0 ? (
          <p className="mt-4 text-sm text-stone-400">No runs are queued or running right now.</p>
        ) : null}

        {!loading && !error && dispatchQueue.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {dispatchQueue.map((run) => (
              <AgentRunListItem key={run.id} run={run} />
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded border border-stone-200/15 bg-stone-100/5 p-4">
        <div className="flex items-center gap-2">
          <ScrollText size={16} className="text-amber-100" />
          <h2 className="text-sm font-semibold text-stone-100">Execution logs</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-stone-400">
          Completed or failed run metadata. Full transcripts and artifacts stay on the local runner
          until sync writeback lands.
        </p>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
            <Loader2 size={14} className="animate-spin" />
            Loading execution logs…
          </div>
        ) : null}

        {!loading && error ? (
          <p className="mt-4 rounded border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-sm text-amber-50">
            {error}
          </p>
        ) : null}

        {!loading && !error && executionLogs.length === 0 ? (
          <p className="mt-4 text-sm text-stone-400">No completed runs are recorded yet.</p>
        ) : null}

        {!loading && !error && executionLogs.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {executionLogs.map((run) => (
              <AgentRunListItem key={run.id} run={run} />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
