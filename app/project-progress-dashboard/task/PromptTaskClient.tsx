'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Play, StopCircle } from 'lucide-react';
import sampleConfig1 from '../../../config/samples/project-manager.sample.json';
import sampleConfig2 from '../../../config/samples/project-manager-self.sample.json';
import { getProjectsRepository } from '../../../lib/storage';
import type {
  AgentAdapterConfig, Feature, FeaturePromptConfig, ProjectManagerConfig,
} from '../../../lib/types';

interface ResolvedRow {
  projectId: string;
  feature: Feature;
  agents: AgentAdapterConfig[];
  projectRoot: string;
}

const INITIAL_CONFIGS: Record<string, ProjectManagerConfig> = {
  'owner-property': sampleConfig1 as unknown as ProjectManagerConfig,
  'project-manager': sampleConfig2 as unknown as ProjectManagerConfig,
};

export function PromptTaskClient() {
  const params = useSearchParams();
  const rowId = params.get('rowId') ?? '';
  const [resolved, setResolved] = useState<ResolvedRow | null>(null);
  const [resolving, setResolving] = useState(true);

  // Load projects from repo + bundled samples, then locate the feature.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const repo = getProjectsRepository();
      const stored = await repo.listProjects();
      const fallbackIds = new Set(['owner-property', 'project-manager']);
      const merged: Record<string, ProjectManagerConfig> = { ...INITIAL_CONFIGS };
      stored.forEach((p) => {
        if (!fallbackIds.has(p.id)) merged[p.id] = p.config;
        else merged[p.id] = p.config; // prefer stored copy if present
      });

      const sepIdx = rowId.indexOf('::');
      const projectId = sepIdx > 0 ? rowId.slice(0, sepIdx) : '';
      const featureId = sepIdx > 0 ? rowId.slice(sepIdx + 2) : rowId;

      let foundProjectId = projectId;
      let feature: Feature | undefined;
      let cfg = projectId ? merged[projectId] : undefined;
      if (cfg) {
        feature = cfg.features.find((f) => f.id === featureId);
      }
      // Fallback: scan all projects when the project prefix is missing or stale.
      if (!feature) {
        for (const [pid, c] of Object.entries(merged)) {
          const hit = c.features.find((f) => f.id === featureId);
          if (hit) {
            foundProjectId = pid;
            feature = hit;
            cfg = c;
            break;
          }
        }
      }
      if (cancelled) return;
      if (feature && cfg) {
        setResolved({
          projectId: foundProjectId,
          feature,
          agents: cfg.adapters.agents,
          projectRoot: cfg.project.root,
        });
      }
      setResolving(false);
    })();
    return () => { cancelled = true; };
  }, [rowId]);

  if (resolving) return <Frame><p className="text-stone-400 text-sm">Loading…</p></Frame>;
  if (!resolved) {
    return (
      <Frame>
        <p className="text-stone-300 text-sm">
          Could not find a feature with id <code className="text-amber-200">{rowId}</code>.
        </p>
        <Link href="/project-progress-dashboard" className="mt-3 inline-flex items-center gap-1 text-emerald-300 text-sm">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </Frame>
    );
  }
  return <PromptTaskEditor row={resolved} />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[rgb(var(--pm-bg-rgb))] text-stone-100">
      <div className="mx-auto max-w-3xl p-6">{children}</div>
    </main>
  );
}

function PromptTaskEditor({ row }: { row: ResolvedRow }) {
  const seed = row.feature.promptConfig;
  const [body, setBody] = useState(seed?.body ?? '');
  const [agentId, setAgentId] = useState(seed?.agentId ?? row.agents[0]?.id ?? '');
  const [autoLoop, setAutoLoop] = useState(seed?.autoLoop ?? false);
  const [stopCondition, setStopCondition] = useState(seed?.stopCondition ?? '');
  const [maxIterations, setMaxIterations] = useState(seed?.maxIterations ?? 5);

  // Run state
  const [running, setRunning] = useState(false);
  const [iterations, setIterations] = useState<RunIteration[]>([]);
  const cancelRef = useRef(false);

  const selectedAgent = useMemo(
    () => row.agents.find((a) => a.id === agentId) ?? row.agents[0],
    [agentId, row.agents],
  );

  const saveConfig = useCallback(async () => {
    const cfg: FeaturePromptConfig = {
      body: body.trim() || undefined,
      agentId,
      autoLoop,
      stopCondition: stopCondition.trim() || undefined,
      maxIterations,
    };
    // Persist by editing the project config through the projects repository.
    const repo = getProjectsRepository();
    const stored = await repo.listProjects();
    const target = stored.find((p) => p.id === row.projectId);
    if (!target) return;
    const updatedConfig: ProjectManagerConfig = {
      ...target.config,
      features: target.config.features.map((f) =>
        f.id === row.feature.id
          ? { ...f, promptConfig: cfg, updatedAt: new Date().toISOString() }
          : f,
      ),
    };
    await repo.saveProjects(stored.map((p) =>
      p.id === row.projectId ? { ...p, config: updatedConfig } : p,
    ));
  }, [body, agentId, autoLoop, stopCondition, maxIterations, row.projectId, row.feature.id]);

  const runOnce = useCallback(async (): Promise<RunIteration> => {
    if (!selectedAgent) {
      return { ok: false, output: 'No agent selected', startedAt: new Date().toISOString(), endedAt: new Date().toISOString() };
    }
    const args = selectedAgent.argsTemplate.map((arg) =>
      arg
        .replace(/\{prompt\}/g, body)
        .replace(/\{featureId\}/g, row.feature.id)
        .replace(/\{root\}/g, row.projectRoot),
    );
    const startedAt = new Date().toISOString();
    try {
      const bridge = await import('../../../lib/bridge');
      const { pid } = await bridge.spawnAgent({
        command: selectedAgent.command,
        args,
        workingDir: row.projectRoot,
      });
      return {
        ok: true,
        pid,
        output: `(launched pid=${pid}; output streamed via Logs view)`,
        startedAt,
        endedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        output: err instanceof Error ? err.message : String(err),
        startedAt,
        endedAt: new Date().toISOString(),
      };
    }
  }, [selectedAgent, body, row.feature.id, row.projectRoot]);

  const runLoop = useCallback(async () => {
    cancelRef.current = false;
    setRunning(true);
    setIterations([]);
    const stopSubstring = stopCondition.trim();
    try {
      for (let i = 0; i < maxIterations; i++) {
        if (cancelRef.current) break;
        const iter = await runOnce();
        setIterations((prev) => [...prev, iter]);
        if (!autoLoop) break;
        if (stopSubstring && iter.output.includes(stopSubstring)) break;
      }
    } finally {
      setRunning(false);
    }
  }, [autoLoop, stopCondition, maxIterations, runOnce]);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  return (
    <main className="min-h-screen bg-[rgb(var(--pm-bg-rgb))] text-stone-100">
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Link href="/project-progress-dashboard" className="inline-flex items-center gap-1 text-emerald-300 text-sm">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <header>
          <h1 className="text-xl font-semibold">Prompt task · {row.feature.id}</h1>
          <p className="text-xs text-stone-400 mt-1">
            {row.feature.name} · {row.feature.category} · {row.projectId}
          </p>
        </header>

        <section className="space-y-3 rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70 p-4">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">Prompt body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded border border-stone-200/15 bg-[rgb(var(--pm-code))]/95 p-2 text-xs text-stone-100 focus:outline-none focus:border-emerald-400/40"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">Agent</span>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="h-7 w-full rounded border border-stone-200/15 bg-[rgb(var(--pm-rail))] px-2 text-xs text-stone-100"
              >
                {row.agents.length === 0 && <option value="">(no agents configured)</option>}
                {row.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">Max iterations</span>
              <input
                type="number" min={1} max={50}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="h-7 w-full rounded border border-stone-200/15 bg-[rgb(var(--pm-rail))] px-2 text-xs text-stone-100"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-200">
            <input type="checkbox" checked={autoLoop} onChange={(e) => setAutoLoop(e.target.checked)} className="accent-emerald-400" />
            Auto-loop until stop condition matches the last run output
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">Stop condition</span>
            <input
              value={stopCondition}
              onChange={(e) => setStopCondition(e.target.value)}
              disabled={!autoLoop}
              placeholder="substring match against run output"
              className="h-7 w-full rounded border border-stone-200/15 bg-[rgb(var(--pm-rail))] px-2 text-xs text-stone-100 disabled:opacity-40"
            />
          </label>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={saveConfig}
              className="rounded border border-stone-200/15 px-3 py-1.5 text-xs text-stone-200 hover:bg-white/5"
            >Save</button>
            {!running ? (
              <button
                onClick={runLoop}
                className="flex items-center gap-1 rounded bg-emerald-500/30 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/40"
              >
                <Play size={12} /> {autoLoop ? 'Run loop' : 'Run once'}
              </button>
            ) : (
              <button
                onClick={cancel}
                className="flex items-center gap-1 rounded bg-red-500/30 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/40"
              >
                <StopCircle size={12} /> Stop after current iteration
              </button>
            )}
            {running && <Loader2 size={14} className="animate-spin text-emerald-300" />}
          </div>
        </section>

        {iterations.length > 0 && (
          <section className="rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-100 mb-2">
              Iterations ({iterations.length})
            </h2>
            <div className="space-y-2">
              {iterations.map((it, idx) => (
                <div key={idx} className="rounded border border-stone-200/10 p-2 text-xs">
                  <p className="text-stone-300">
                    #{idx + 1} · {it.ok ? <span className="text-emerald-300">ok</span> : <span className="text-red-300">error</span>}
                    {it.pid != null && <> · pid {it.pid}</>}
                    {' · '}
                    {new Date(it.startedAt).toLocaleTimeString()}
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap text-stone-200 font-mono">{it.output}</pre>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

interface RunIteration {
  ok: boolean;
  pid?: number;
  output: string;
  startedAt: string;
  endedAt: string;
}
