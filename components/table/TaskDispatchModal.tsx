'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  augmentArgsWithMcp,
  killProcess,
  mcpInjectionFlag,
  onAgentExit,
  onAgentStdout,
  readFile,
  spawnAgent,
  spawnTerminal,
} from '../../lib/bridge';
import {
  DEFAULT_AGENT_WORKFLOWS,
  buildAgentWorkflowPrompt,
  getAgentWorkflowById,
} from '../../lib/agent-workflows';
import { createRuntimeAdapterFromConfig } from '../../lib/adapters/registry';
import { collectEnabledMcpServers } from '../../lib/storage/plugins';
import { useI18n } from '../../lib/i18n';
import type { Translations } from '../../lib/i18n/types';
import {
  AnyAdapterConfig,
  EngineerRole,
  ExecutionResult,
  Feature,
  FeaturePhase,
  FeaturePromptConfig,
  IDEId,
} from '../../lib/types';

// ── Prompt helpers ────────────────────────────────────────────────────────────

type DispatchT = Translations['dispatch'];

interface PromptTemplate {
  label: string;
  build: (feature: Feature, specContent?: string) => string;
}

function makePromptTemplates(d: DispatchT): PromptTemplate[] {
  return [
    {
      label: d.templateFromScratch,
      build: (f, spec) =>
        `[${f.id}] ${f.name}\n` +
        `${d.promptImplPath} ${f.paths.implementation ?? d.promptUnspecified}\n` +
        (f.notes ? `${d.promptNotes} ${f.notes}\n` : '') +
        (spec ? `\n${d.promptSpecHeader}\n${spec.slice(0, 1500)}` : ''),
    },
    {
      label: d.templateAddTests,
      build: (f) =>
        `[${f.id}] ${f.name}\n` +
        `${d.promptTestPath} ${f.paths.unitIntegrationTest ?? f.paths.test ?? d.promptUnspecified}\n` +
        `${d.promptImplPath} ${f.paths.implementation ?? d.promptUnspecified}`,
    },
    {
      label: d.templateDebug,
      build: (f) =>
        `[${f.id}] ${f.name}\n` +
        `${d.promptImplPath} ${f.paths.implementation ?? d.promptUnspecified}\n` +
        `${d.promptStatus} ${f.progress}%`,
    },
    {
      label: d.templateCodeReview,
      build: (f) =>
        `[${f.id}] ${f.name}\n` +
        `${d.promptImplPath} ${f.paths.implementation ?? d.promptUnspecified}`,
    },
    {
      label: d.templateWriteDocs,
      build: (f) =>
        `[${f.id}] ${f.name}\n` +
        `${d.promptImplPath} ${f.paths.implementation ?? d.promptUnspecified}`,
    },
  ];
}

function buildDefaultPrompt(feature: Feature, d: DispatchT, specContent?: string): string {
  let text = `[${feature.id}] ${feature.name}\n`;
  text += `${d.promptStatus} ${feature.status} (${feature.progress}%)\n`;
  text += `${d.promptImplPath} ${feature.paths.implementation ?? d.promptUnspecified}\n`;
  if (feature.notes) text += `${d.promptNotes} ${feature.notes}\n`;
  if (specContent) text += `\n${d.promptSpecHeader}\n${specContent.slice(0, 1500)}`;
  return text;
}

function resolvePath(filePath: string, projectRoot: string): string {
  if (filePath.startsWith('/')) return filePath;
  return `${projectRoot.replace(/\/$/, '')}/${filePath}`;
}

const IDE_IDS: IDEId[] = ['Cursor', 'VSCode', 'Trae', 'Antigravity'];

const PHASE_OPTIONS: Array<{ value: FeaturePhase; phaseKey: keyof Translations['phases'] }> = [
  { value: 'development', phaseKey: 'development' },
  { value: 'e2e_testing', phaseKey: 'e2eTesting' },
  { value: 'deployment', phaseKey: 'deployment' },
  { value: 'operations', phaseKey: 'operations' },
];

function adapterToIDE(adapter: AnyAdapterConfig): IDEId | undefined {
  if (adapter.type !== 'ide') return undefined;
  if (IDE_IDS.includes(adapter.id as IDEId)) return adapter.id as IDEId;
  return IDE_IDS.find((id) => id === adapter.name);
}

function resolveInitialAdapterId(
  feature: Feature,
  adapters: AnyAdapterConfig[],
  engineerRoles: EngineerRole[],
  defaultIDE?: IDEId,
): string {
  const savedAgent = feature.promptConfig?.agentId;
  if (savedAgent && adapters.some((a) => a.id === savedAgent)) return savedAgent;

  if (feature.assignedRoleId) {
    const role = engineerRoles.find((r) => r.id === feature.assignedRoleId);
    if (role?.defaultAgentId && adapters.some((a) => a.id === role.defaultAgentId)) {
      return role.defaultAgentId;
    }
  }

  const ide = feature.assignedIDE ?? defaultIDE;
  if (ide) {
    const ideAdapter = adapters.find(
      (a) => adapterToIDE(a) === ide || a.id === ide,
    );
    if (ideAdapter) return ideAdapter.id;
  }

  return adapters[0]?.id ?? '';
}

// ── Component ─────────────────────────────────────────────────────────────────

type DispatchFeatureUpdate = Partial<
  Pick<
    Feature,
    | 'status' | 'progress' | 'assignedRoleId' | 'assignedIDE' | 'phase' | 'promptConfig'
    | 'assignedTo' | 'assignedAt'
  >
>;

interface TaskDispatchModalProps {
  feature: Feature;
  adapters: AnyAdapterConfig[];
  projectRoot: string;
  engineerRoles?: EngineerRole[];
  /** Project default IDE when the feature has no per-row override. */
  defaultIDE?: IDEId;
  onClose: () => void;
  onExecuted: (result: ExecutionResult) => void;
  onRunStart?: (
    pid: number,
    featureId: string,
    featureName: string,
    command: string,
    args: string[],
  ) => void;
  onRunLog?: (pid: number, line: string) => void;
  onRunEnd?: (pid: number, exitCode: number) => void;
  onFeatureUpdate?: (featureId: string, update: DispatchFeatureUpdate) => void;
}

type Phase = 'idle' | 'running' | 'done' | 'error';

export function TaskDispatchModal({
  feature,
  adapters,
  projectRoot,
  engineerRoles = [],
  defaultIDE,
  onClose,
  onExecuted,
  onRunStart,
  onRunLog,
  onRunEnd,
  onFeatureUpdate,
}: TaskDispatchModalProps) {
  const { t } = useI18n();
  const d = t.dispatch;

  const promptTemplates = useMemo(() => makePromptTemplates(d), [d]);

  const [selectedRoleId, setSelectedRoleId] = useState(feature.assignedRoleId ?? '');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [selectedAdapterId, setSelectedAdapterId] = useState(() =>
    resolveInitialAdapterId(feature, adapters, engineerRoles, defaultIDE),
  );
  const [selectedPhase, setSelectedPhase] = useState<FeaturePhase>(
    feature.phase ?? 'development',
  );
  const [prompt, setPrompt] = useState('');
  const [autoLoop, setAutoLoop] = useState(feature.promptConfig?.autoLoop ?? false);
  const [stopCondition, setStopCondition] = useState(feature.promptConfig?.stopCondition ?? '');
  const [maxIterations, setMaxIterations] = useState(feature.promptConfig?.maxIterations ?? 5);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(feature.promptConfig?.autoLoop || feature.promptConfig?.stopCondition),
  );
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [activePid, setActivePid] = useState<number | null>(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [mcpInjection, setMcpInjection] = useState<{ count: number; flag: string } | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<Array<() => void>>([]);
  const activePidRef = useRef<number | null>(null);

  const selectedAdapter = adapters.find((a) => a.id === selectedAdapterId);
  const isIDE = selectedAdapter?.type === 'ide';
  const selectedRole = engineerRoles.find((r) => r.id === selectedRoleId) ?? null;
  const selectedWorkflow = selectedWorkflowId ? getAgentWorkflowById(selectedWorkflowId) ?? null : null;

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const role = engineerRoles.find((r) => r.id === roleId);
    if (role?.defaultAgentId) {
      const match = adapters.find((a) => a.id === role.defaultAgentId);
      if (match) setSelectedAdapterId(match.id);
    }
  };

  const buildAssignmentPatch = (): DispatchFeatureUpdate => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    const promptConfig: FeaturePromptConfig = {
      body: prompt.trim() || undefined,
      agentId: selectedAdapterId || undefined,
      autoLoop: autoLoop || undefined,
      stopCondition: autoLoop && stopCondition.trim() ? stopCondition.trim() : undefined,
      maxIterations: autoLoop ? maxIterations : undefined,
    };
    const role = engineerRoles.find((r) => r.id === selectedRoleId);
    const assignedTo = role
      ? `${adapter?.name ?? selectedAdapterId} (${role.name})`
      : (adapter?.name ?? selectedAdapterId);
    const patch: DispatchFeatureUpdate = {
      assignedRoleId: selectedRoleId || undefined,
      phase: selectedPhase,
      promptConfig,
      assignedTo: assignedTo || undefined,
      assignedAt: new Date().toISOString(),
    };
    const ide = adapter ? adapterToIDE(adapter) : undefined;
    if (ide) patch.assignedIDE = ide;
    return patch;
  };

  // Load saved prompt or spec content and build default prompt on mount
  useEffect(() => {
    let cancelled = false;
    const savedBody = feature.promptConfig?.body?.trim();
    if (savedBody) {
      setPrompt(savedBody);
      return;
    }

    const specPath = feature.paths.spec ?? feature.paths.tdd;

    if (!specPath) {
      setPrompt(buildDefaultPrompt(feature, d));
      return;
    }

    setSpecLoading(true);
    readFile(resolvePath(specPath, projectRoot))
      .then((content) => {
        if (!cancelled) setPrompt(buildDefaultPrompt(feature, d, content || undefined));
      })
      .catch(() => {
        if (!cancelled) setPrompt(buildDefaultPrompt(feature, d));
      })
      .finally(() => {
        if (!cancelled) setSpecLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feature, projectRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute MCP injection preview whenever adapter or project root changes.
  useEffect(() => {
    if (!selectedAdapter || selectedAdapter.type === 'ide') {
      setMcpInjection(null);
      return;
    }
    const flag = mcpInjectionFlag(selectedAdapter.command);
    if (!flag) {
      setMcpInjection(null);
      return;
    }
    const servers = collectEnabledMcpServers(projectRoot);
    const count = Object.keys(servers).length;
    setMcpInjection(count > 0 ? { count, flag } : null);
  }, [selectedAdapter, projectRoot]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach((fn) => fn());
    };
  }, []);

  const applyTemplate = (tpl: PromptTemplate) => {
    const specPath = feature.paths.spec ?? feature.paths.tdd;
    if (specPath) {
      readFile(resolvePath(specPath, projectRoot))
        .then((content) => setPrompt(tpl.build(feature, content || undefined)))
        .catch(() => setPrompt(tpl.build(feature)));
    } else {
      setPrompt(tpl.build(feature));
    }
  };

  const buildExecutionPrompt = () => {
    let effectivePrompt = prompt;
    if (selectedRole) {
      const parts: string[] = [];
      if (selectedRole.systemPrompt) {
        parts.push(`[${d.engineerLabel}: ${selectedRole.name}]\n${selectedRole.systemPrompt}`);
      }
      if (selectedRole.referenceFiles.length > 0) {
        parts.push(`${d.refsPrefix}\n${selectedRole.referenceFiles.map((f) => `- ${f}`).join('\n')}`);
      }
      if (parts.length > 0) {
        effectivePrompt = `${parts.join('\n\n')}\n\n---\n\n${prompt}`;
      }
    }
    if (selectedWorkflow) {
      effectivePrompt = buildAgentWorkflowPrompt(selectedWorkflow, feature, effectivePrompt);
    }
    return effectivePrompt;
  };

  const buildCommand = async (adapter: AnyAdapterConfig): Promise<{ command: string; args: string[] }> => {
    const runtimeAdapter = createRuntimeAdapterFromConfig(adapter);
    const result = await runtimeAdapter.execute({
      feature,
      prompt: buildExecutionPrompt(),
      projectRoot,
    });
    if (!result.success || !result.command || !result.args) {
      throw new Error(result.message ?? `Unable to build command for ${adapter.name}`);
    }
    return { command: result.command, args: result.args };
  };

  const handleExecute = async () => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    if (!adapter) return;

    setPhase('running');
    setLogs([]);

    onFeatureUpdate?.(feature.id, { ...buildAssignmentPatch(), status: 'in_progress' });

    try {
      const { command, args: baseArgs } = await buildCommand(adapter);
      const args = await augmentArgsWithMcp(command, baseArgs, collectEnabledMcpServers(projectRoot));
      const unStdout = await onAgentStdout(({ pid: eventPid, line }) => {
        if (activePidRef.current !== null && eventPid !== activePidRef.current) return;
        setLogs((prev) => [...prev, line]);
        onRunLog?.(eventPid, line);
      });
      const unExit = await onAgentExit(({ pid: exitPid, code }) => {
        if (activePidRef.current !== null && exitPid !== activePidRef.current) return;
        const exitLine = `\n── process exited (PID ${exitPid}, code ${code}) ──`;
        setLogs((prev) => [...prev, exitLine]);
        const succeeded = code === 0;
        setPhase(succeeded ? 'done' : 'error');
        setActivePid(null);
        activePidRef.current = null;
        onRunEnd?.(exitPid, code);
        onFeatureUpdate?.(feature.id, { assignedTo: undefined, assignedAt: undefined });
        if (succeeded) {
          onFeatureUpdate?.(feature.id, { progress: Math.min(feature.progress + 20, 100) });
        }
      });
      unlistenRefs.current.push(unStdout, unExit);

      const pid = await spawnAgent({ command, args, workingDir: projectRoot });
      setActivePid(pid);
      activePidRef.current = pid;
      onRunStart?.(pid, feature.id, feature.name, command, args);

      onExecuted({
        success: true,
        message: `${adapter.name} started (PID: ${pid})`,
        command,
        args,
        dryRun: false,
        pid,
      });
    } catch (err) {
      setLogs((prev) => [...prev, `Error: ${err}`]);
      setPhase('error');
    }
  };

  const handleOpenInTerminal = async () => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    if (!adapter) return;

    try {
      const { command, args: baseArgs } = await buildCommand(adapter);
      const args = await augmentArgsWithMcp(command, baseArgs, collectEnabledMcpServers(projectRoot));
      // AppleScript `do script` injects newlines as Enter mid-typing on macOS,
      // so collapse literal newlines in args into spaces before spawning.
      const flatArgs = args.map((a) => a.replace(/\r?\n/g, ' '));
      await spawnTerminal({ command, args: flatArgs, cwd: projectRoot });
      onFeatureUpdate?.(feature.id, { ...buildAssignmentPatch(), status: 'in_progress' });
      onExecuted({
        success: true,
        message: `${adapter.name} opened in new Terminal window`,
        command,
        args: flatArgs,
        dryRun: false,
      });
      onClose();
    } catch (err) {
      setPhase('error');
      setLogs([`Failed to open terminal: ${err}`]);
    }
  };

  const handleKill = async () => {
    if (activePid == null) return;
    await killProcess(activePid);
    setActivePid(null);
    activePidRef.current = null;
  };

  const isRunning = phase === 'running';
  const isAssignedBlocked =
    phase === 'idle' &&
    !!feature.assignedTo &&
    feature.status === 'in_progress' &&
    !overrideConfirmed;

  // Target file display for IDE adapters
  const ideTargetFile =
    feature.paths.implementation ?? feature.paths.tdd ?? feature.paths.spec ?? '.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-xl flex-col overflow-hidden border border-stone-200/18 bg-[#071d1a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-stone-50">{d.title}</h3>
            <p className="text-xs text-stone-400">
              {feature.id} — {feature.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-stone-400 hover:text-stone-100"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {phase === 'idle' && feature.assignedTo && feature.status === 'in_progress' && !overrideConfirmed && (
            <div className="flex items-start justify-between gap-3 border border-amber-400/30 bg-amber-500/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-200">
                  {d.assignedToWarning
                    .replace('{name}', feature.assignedTo)
                    .replace('{date}', feature.assignedAt
                      ? new Date(feature.assignedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                      : '—')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverrideConfirmed(true)}
                className="shrink-0 border border-amber-400/40 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
              >
                {d.assignedToContinue}
              </button>
            </div>
          )}

        {phase === 'idle' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-200">
                  {d.phaseLabel}
                </label>
                <select
                  value={selectedPhase}
                  onChange={(e) => setSelectedPhase(e.target.value as FeaturePhase)}
                  className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                >
                  {PHASE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value === 'e2e_testing'
                        ? `E2E — ${t.phases.e2eTesting}`
                        : `${opt.value.toUpperCase().slice(0, 3)} — ${t.phases[opt.phaseKey]}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Engineer role selector */}
              {engineerRoles.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-200">
                    {d.engineerLabel}
                  </label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                  >
                    <option value="">{d.noRole}</option>
                    {engineerRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {selectedRole && (
                    <div className="mt-1.5 border border-stone-200/12 bg-[#061512]/60 px-3 py-2 text-[11px] text-stone-400">
                      <span className="text-stone-300">{d.systemPromptPrefix}</span>
                      {selectedRole.systemPrompt.slice(0, 80)}…
                      {selectedRole.referenceFiles.length > 0 && (
                        <span className="ml-2 text-stone-500">
                          {d.refsPrefix}{selectedRole.referenceFiles.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Workflow selector */}
              {!isIDE && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-200">
                    {d.workflowLabel}
                  </label>
                  <select
                    value={selectedWorkflowId}
                    onChange={(e) => setSelectedWorkflowId(e.target.value)}
                    className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                  >
                    <option value="">{d.noWorkflow}</option>
                    {DEFAULT_AGENT_WORKFLOWS.map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name} · {workflow.mode}
                      </option>
                    ))}
                  </select>
                  {selectedWorkflow && (
                    <div className="mt-1.5 border border-stone-200/12 bg-[#061512]/60 px-3 py-2 text-[11px] text-stone-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="border border-amber-200/25 px-1.5 py-0.5 font-mono uppercase tracking-[0.12em] text-amber-200/80">
                          {selectedWorkflow.mode}
                        </span>
                        <span className="text-stone-300">{selectedWorkflow.role}</span>
                        <span>{selectedWorkflow.summary}</span>
                      </div>
                      <p className="mt-1 text-stone-500">
                        Required evidence: {selectedWorkflow.requiredChecks.slice(0, 2).join(' · ')}
                        {selectedWorkflow.requiredChecks.length > 2 ? ' · …' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Adapter selector (agent CLI or IDE) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-200">
                  {d.runtimeLabel}
                </label>
                <select
                  value={selectedAdapterId}
                  onChange={(e) => setSelectedAdapterId(e.target.value)}
                  className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                >
                  {adapters.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
                {mcpInjection && (
                  <p className="mt-1.5 text-[11px] text-emerald-300/80">
                    {d.mcpInjected
                      .replace('{count}', String(mcpInjection.count))
                      .replace('{flag}', mcpInjection.flag)}
                  </p>
                )}
              </div>

              {isIDE ? (
                /* IDE mode: show target file, no prompt needed */
                <div className="border border-stone-200/12 bg-[#03100f] p-3">
                  <p className="mb-1.5 text-xs font-medium text-stone-400">{d.openFileLabel}</p>
                  <p className="break-all font-mono text-xs text-stone-200">{ideTargetFile}</p>
                </div>
              ) : (
                /* Agent mode: template picker + prompt textarea */
                <>
                  <div>
                    <p className="mb-2 text-xs font-medium text-stone-400">{d.templatesLabel}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {promptTemplates.map((tpl) => (
                        <button
                          key={tpl.label}
                          onClick={() => applyTemplate(tpl)}
                          className="border border-stone-200/20 px-2.5 py-1 text-xs text-stone-300 transition-colors hover:border-emerald-200/40 hover:bg-emerald-100/10 hover:text-emerald-100"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-stone-200">
                      {d.promptLabel}
                      {specLoading && (
                        <span className="ml-2 animate-pulse text-xs font-normal text-stone-500">
                          {d.loadingSpec}
                        </span>
                      )}
                    </label>
                    <textarea
                      rows={7}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                    />
                  </div>
                </>
              )}

              <div className="border border-stone-200/12">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-stone-300 hover:bg-white/5"
                >
                  {d.advancedTitle}
                  <span className="text-stone-500">{showAdvanced ? '−' : '+'}</span>
                </button>
                {showAdvanced && (
                  <div className="space-y-3 border-t border-stone-200/12 px-3 py-3 text-xs text-stone-200">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoLoop}
                        onChange={(e) => setAutoLoop(e.target.checked)}
                        className="accent-emerald-400"
                      />
                      {d.autoRetryLabel}
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">
                        {d.stopConditionLabel}
                      </span>
                      <input
                        value={stopCondition}
                        onChange={(e) => setStopCondition(e.target.value)}
                        placeholder="e.g. all tests pass"
                        disabled={!autoLoop}
                        className="h-7 w-full border border-stone-200/15 bg-[#03100f] px-2 text-xs text-stone-100 disabled:opacity-50"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">
                        {d.maxIterationsLabel}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={maxIterations}
                        onChange={(e) =>
                          setMaxIterations(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                        }
                        disabled={!autoLoop}
                        className="h-7 w-24 border border-stone-200/15 bg-[#03100f] px-2 text-xs text-stone-100 disabled:opacity-50"
                      />
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {phase !== 'idle' && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-stone-200">
                  {isRunning ? d.liveOutput : d.executionLog}
                </label>
                {activePid != null && (
                  <span className="text-xs text-stone-400">PID {activePid}</span>
                )}
              </div>
              <div className="max-h-64 overflow-auto border border-stone-200/12 bg-[#03100f] p-3 font-mono text-xs leading-5 text-stone-200">
                {logs.length === 0 ? (
                  <span className="animate-pulse text-stone-500">{d.waitingOutput}</span>
                ) : (
                  logs.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-300 hover:bg-white/5"
          >
            {isRunning ? d.backgroundBtn : d.closeBtn}
          </button>
          {isRunning && activePid != null && (
            <button
              onClick={handleKill}
              className="border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40"
            >
              Kill
            </button>
          )}
          {phase === 'idle' && !isIDE && (
            <button
              onClick={handleOpenInTerminal}
              disabled={specLoading || isAssignedBlocked}
              className="border border-stone-200/25 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-white/5 disabled:opacity-50"
            >
              {d.openTerminalBtn}
            </button>
          )}
          {phase === 'idle' && (
            <button
              onClick={handleExecute}
              disabled={specLoading || isAssignedBlocked}
              className="bg-stone-100 px-4 py-2 text-sm font-medium text-[#071d1a] hover:bg-amber-100 disabled:opacity-50"
            >
              {isIDE ? d.dispatchBtn : d.runInPMBtn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
