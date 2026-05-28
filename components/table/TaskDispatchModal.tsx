'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  augmentArgsWithMcp,
  killProcess,
  onAgentExit,
  onAgentStdout,
  spawnAgent,
  spawnTerminal,
} from '../../lib/bridge';
import {
  buildAgentWorkflowRunPrompt,
  buildAgentWorkflowPrompt,
  createAgentWorkflowRun,
  getAgentWorkflowDagById,
  getAgentWorkflowById,
  saveAgentWorkflowRun,
} from '../../lib/agent-workflows';
import {
  createRuntimeAdapterFromConfig,
  getAdapterExecutionKind,
} from '../../lib/adapters/registry';
import { listLlmProviders } from '../../lib/keys/llmProviders';
import { prependAgentTeamContext } from '../../lib/dispatch/assembleAgentTeamPrompt';
import { collectEnabledMcpServers } from '../../lib/storage/plugins';
import { useI18n } from '../../lib/i18n';
import { BottomSheetTabs, type SheetTabItem } from '../sheets/BottomSheetTabs';
import {
  RoleConfigPanel,
  initialRoleConfigState,
  adapterToIDE,
  type RoleConfigState,
} from './RoleConfigPanel';
import type {
  AnyAdapterConfig,
  EngineerRole,
  ExecutionResult,
  Feature,
  FeaturePhase,
  FeaturePromptConfig,
  HarnessTaskRole,
  IDEId,
} from '../../lib/types';
import type { AgentWorkflowDagDefinition, AgentWorkflowRun } from '../../lib/agent-workflows';

// ── Types ───────────────────────────────────────────────────────────────────

type DispatchFeatureUpdate = Partial<
  Pick<
    Feature,
    | 'status' | 'progress' | 'assignedRoleId' | 'assignedIDE' | 'phase' | 'promptConfig'
    | 'assignedTo' | 'assignedAt' | 'harnessAssignments'
  >
>;

interface TaskDispatchModalProps {
  feature: Feature;
  adapters: AnyAdapterConfig[];
  projectRoot: string;
  engineerRoles?: EngineerRole[];
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

type RolePhase = 'idle' | 'pending' | 'running' | 'done' | 'error';

interface RoleRunState {
  phase: RolePhase;
  activePid: number | null;
}

interface LogEntry {
  role: HarnessTaskRole;
  line: string;
}

interface DagWorkflowSelection {
  workflow: AgentWorkflowDagDefinition;
  run: AgentWorkflowRun;
}

const ROLES: HarnessTaskRole[] = ['planner', 'worker', 'evaluator'];

const ROLE_SHORT: Record<HarnessTaskRole, string> = {
  planner: 'P',
  worker: 'W',
  evaluator: 'E',
};

const ROLE_LOG_COLOR: Record<HarnessTaskRole, string> = {
  planner: 'text-stone-300',
  worker: 'text-cyan-200',
  evaluator: 'text-amber-200',
};

const PHASE_OPTIONS: Array<{ value: FeaturePhase; label: string }> = [
  { value: 'development', label: 'DEV — Development' },
  { value: 'e2e_testing', label: 'E2E — E2E Testing' },
  { value: 'deployment', label: 'DEP — Deployment' },
  { value: 'operations', label: 'OPS — Operations' },
];

function roleBadge(runState: RoleRunState): React.ReactNode {
  switch (runState.phase) {
    case 'running':
      return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />;
    case 'done':
      return <span className="text-[10px] text-emerald-300">✓</span>;
    case 'error':
      return <span className="text-[10px] text-red-300">✗</span>;
    case 'pending':
      return <span className="inline-block h-2 w-2 animate-spin rounded-full border border-stone-300 border-t-transparent" />;
    default:
      return undefined;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

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
  const llmProviders = useMemo(() => listLlmProviders(), []);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [activeRole, setActiveRole] = useState<HarnessTaskRole>('worker');
  const [selectedPhase, setSelectedPhase] = useState<FeaturePhase>(feature.phase ?? 'development');
  const [killConfirmPid, setKillConfirmPid] = useState<number | null>(null);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);

  // ── Per-role config state ─────────────────────────────────────────────────
  const [plannerConfig, setPlannerConfig] = useState<RoleConfigState>(() =>
    initialRoleConfigState('planner', feature, adapters, engineerRoles, defaultIDE),
  );
  const [workerConfig, setWorkerConfig] = useState<RoleConfigState>(() =>
    initialRoleConfigState('worker', feature, adapters, engineerRoles, defaultIDE),
  );
  const [evaluatorConfig, setEvaluatorConfig] = useState<RoleConfigState>(() =>
    initialRoleConfigState('evaluator', feature, adapters, engineerRoles, defaultIDE),
  );

  const configByRole: Record<HarnessTaskRole, RoleConfigState> = {
    planner: plannerConfig,
    worker: workerConfig,
    evaluator: evaluatorConfig,
  };

  const setConfigByRole: Record<HarnessTaskRole, React.Dispatch<React.SetStateAction<RoleConfigState>>> = {
    planner: setPlannerConfig,
    worker: setWorkerConfig,
    evaluator: setEvaluatorConfig,
  };

  const handleConfigChange = useCallback((role: HarnessTaskRole, patch: Partial<RoleConfigState>) => {
    setConfigByRole[role]((prev) => ({ ...prev, ...patch }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-role run state ────────────────────────────────────────────────────
  const [runStates, setRunStates] = useState<Record<HarnessTaskRole, RoleRunState>>({
    planner: { phase: 'idle', activePid: null },
    worker: { phase: 'idle', activePid: null },
    evaluator: { phase: 'idle', activePid: null },
  });

  // ── Merged log panel ──────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<Array<() => void>>([]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach((fn) => fn());
    };
  }, []);

  // ── Sheet tabs ────────────────────────────────────────────────────────────
  const sheetTabs: ReadonlyArray<SheetTabItem<HarnessTaskRole>> = useMemo(() =>
    ROLES.map((role) => ({
      key: role,
      label: `${ROLE_SHORT[role]} — ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      badge: roleBadge(runStates[role]),
    })),
    [runStates],
  );

  // ── Dispatch logic ────────────────────────────────────────────────────────
  const buildDagWorkflowSelection = useCallback((role: HarnessTaskRole, config: RoleConfigState): DagWorkflowSelection | null => {
    if (!config.selectedDagWorkflowId) return null;
    const workflow = getAgentWorkflowDagById(config.selectedDagWorkflowId);
    if (!workflow) return null;
    return {
      workflow,
      run: createAgentWorkflowRun(workflow, {
        projectId: projectRoot,
        featureId: feature.id,
        selectedBy: role,
      }),
    };
  }, [feature.id, projectRoot]);

  const buildAssignmentPatch = useCallback((
    role: HarnessTaskRole,
    config: RoleConfigState,
    dagSelection?: DagWorkflowSelection | null,
  ): DispatchFeatureUpdate => {
    const adapter = adapters.find((a) => a.id === config.selectedAdapterId);
    const engineerRole = engineerRoles.find((r) => r.id === config.selectedRoleId);
    const lastDispatchModel = engineerRole?.primaryModel
      ? `${engineerRole.primaryModel.providerId}/${engineerRole.primaryModel.modelId}`
      : undefined;
    const promptConfig: FeaturePromptConfig = {
      body: config.prompt.trim() || undefined,
      agentId: config.selectedAdapterId || undefined,
      autoLoop: config.autoLoop || undefined,
      stopCondition: config.autoLoop && config.stopCondition.trim() ? config.stopCondition.trim() : undefined,
      maxIterations: config.autoLoop ? config.maxIterations : undefined,
      lastDispatchModel,
      workflowTemplateId: config.selectedDagWorkflowId || undefined,
      workflowRunId: dagSelection?.run.id,
    };
    const adapterLabel = adapter?.name ?? config.selectedAdapterId;
    const roleLabel = engineerRole ? ` (${engineerRole.name})` : '';
    const assignedTo = `${adapterLabel}${roleLabel}`;
    const now = new Date().toISOString();
    const ide = adapter ? adapterToIDE(adapter) : undefined;

    const nextAssignments = { ...(feature.harnessAssignments ?? {}) };
    const nextRoleAssignment = {
      ...(feature.harnessAssignments?.[role]),
      engineerRoleId: config.selectedRoleId || undefined,
      assignedIDE: ide,
      assignedTo: assignedTo || undefined,
      assignedAt: now,
      adapterId: config.selectedAdapterId || undefined,
      lastDispatchModel,
    };
    nextAssignments[role] = nextRoleAssignment;

    const patch: DispatchFeatureUpdate = {
      phase: selectedPhase,
      promptConfig,
      harnessAssignments: nextAssignments,
    };
    if (role === 'worker') {
      patch.assignedRoleId = config.selectedRoleId || undefined;
      patch.assignedTo = assignedTo || undefined;
      patch.assignedAt = now;
      if (ide) patch.assignedIDE = ide;
    }
    return patch;
  }, [adapters, engineerRoles, feature, selectedPhase]);

  const buildExecutionPrompt = useCallback(async (
    role: HarnessTaskRole,
    config: RoleConfigState,
    dagSelection?: DagWorkflowSelection | null,
  ): Promise<string> => {
    let effectivePrompt = config.prompt;
    const engineerRole = engineerRoles.find((r) => r.id === config.selectedRoleId);
    const adapter = adapters.find((a) => a.id === config.selectedAdapterId);
    const isIDE = adapter && getAdapterExecutionKind(adapter) === 'ide';

    if (!isIDE && engineerRole?.primaryModel) {
      const providerLabel = llmProviders.find((p) => p.id === engineerRole.primaryModel!.providerId)?.label ?? engineerRole.primaryModel.providerId;
      effectivePrompt =
        `[Agent Model]\nModel Company: ${providerLabel}\nModel Model: ${engineerRole.primaryModel.modelId}\n\n---\n\n${effectivePrompt}`;
    }

    const workingScopeBlock =
      engineerRole?.workingScope && engineerRole.workingScope.allowedPaths.length > 0
        ? `[Working Scope]\nOnly modify files within these paths:\n${engineerRole.workingScope.allowedPaths.map((p) => `- ${p}`).join('\n')}\nDo not create or edit files outside these directories.`
        : undefined;

    if (engineerRole) {
      effectivePrompt = await prependAgentTeamContext(projectRoot, engineerRole, effectivePrompt, {
        engineerLabel: d.engineerLabel,
        refsPrefix: d.refsPrefix,
        harnessRole: role,
        workingScopeBlock,
      });
    }

    const selectedWorkflow = config.selectedWorkflowId ? getAgentWorkflowById(config.selectedWorkflowId) ?? null : null;
    if (selectedWorkflow) {
      effectivePrompt = buildAgentWorkflowPrompt(selectedWorkflow, feature, effectivePrompt);
    }
    if (dagSelection) {
      effectivePrompt = buildAgentWorkflowRunPrompt(dagSelection.workflow, dagSelection.run, feature, effectivePrompt);
    }
    return effectivePrompt;
  }, [adapters, d, engineerRoles, feature, llmProviders, projectRoot]);

  const dispatchRole = useCallback(async (role: HarnessTaskRole) => {
    const config = configByRole[role];
    const adapter = adapters.find((a) => a.id === config.selectedAdapterId);
    if (!adapter) return;

    const targetKind = getAdapterExecutionKind(adapter);
    const isIDE = targetKind === 'ide';
    const isAgentApp = targetKind === 'agent-app';
    const dagSelection = buildDagWorkflowSelection(role, config);
    if (dagSelection) {
      await saveAgentWorkflowRun(projectRoot, dagSelection.run);
    }

    const assignmentPatch = buildAssignmentPatch(role, config, dagSelection);
    onFeatureUpdate?.(
      feature.id,
      role === 'worker'
        ? { ...assignmentPatch, status: 'in_progress' }
        : assignmentPatch,
    );

    if (isIDE || isAgentApp) {
      try {
        const runtimeAdapter = createRuntimeAdapterFromConfig(adapter);
        const result = await runtimeAdapter.execute({
          feature,
          prompt: await buildExecutionPrompt(role, config, dagSelection),
          projectRoot,
        });
        if (!result.success || !result.command || !result.args) {
          throw new Error(result.message ?? `Unable to build command for ${adapter.name}`);
        }
        const pid = await spawnAgent({ command: result.command, args: result.args, workingDir: projectRoot });
        setLogs((prev) => [...prev, { role, line: `── ${ROLE_SHORT[role]} opened ${adapter.name} (PID ${pid}) ──` }]);
        onExecuted({ success: true, message: `${adapter.name} opened (PID: ${pid})`, command: result.command, args: result.args, dryRun: false, pid });
      } catch (err) {
        setLogs((prev) => [...prev, { role, line: `Error: ${err}` }]);
        setRunStates((prev) => ({ ...prev, [role]: { phase: 'error' as const, activePid: null } }));
      }
      return;
    }

    setRunStates((prev) => ({ ...prev, [role]: { phase: 'pending' as const, activePid: null } }));

    try {
      const runtimeAdapter = createRuntimeAdapterFromConfig(adapter);
      const result = await runtimeAdapter.execute({
        feature,
        prompt: await buildExecutionPrompt(role, config, dagSelection),
        projectRoot,
      });
      if (!result.success || !result.command || !result.args) {
        throw new Error(result.message ?? `Unable to build command for ${adapter.name}`);
      }
      const { command, args: baseArgs } = result;
      const args = await augmentArgsWithMcp(command, baseArgs, collectEnabledMcpServers(projectRoot));

      const unStdout = await onAgentStdout(({ pid: eventPid, line }) => {
        setRunStates((cur) => {
          if (cur[role].activePid !== null && eventPid !== cur[role].activePid) return cur;
          return cur;
        });
        setLogs((prev) => [...prev, { role, line }]);
        onRunLog?.(eventPid, line);
      });

      const unExit = await onAgentExit(({ pid: exitPid, code }) => {
        setRunStates((cur) => {
          if (cur[role].activePid !== null && exitPid !== cur[role].activePid) return cur;
          const succeeded = code === 0;
          const nextAssignments = { ...(feature.harnessAssignments ?? {}) };
          nextAssignments[role] = {
            ...nextAssignments[role],
            activePid: undefined,
            status: succeeded ? 'done' : 'error',
          };
          onFeatureUpdate?.(feature.id, { harnessAssignments: nextAssignments });
          return { ...cur, [role]: { phase: (succeeded ? 'done' : 'error') as RolePhase, activePid: null } };
        });
        setLogs((prev) => [...prev, { role, line: `\n── ${ROLE_SHORT[role]} exited (PID ${exitPid}, code ${code}) ──` }]);
        onRunEnd?.(exitPid, code);
        if (role === 'worker') {
          onFeatureUpdate?.(feature.id, { assignedTo: undefined, assignedAt: undefined });
        }
      });

      unlistenRefs.current.push(unStdout, unExit);

      const pid = await spawnAgent({ command, args, workingDir: projectRoot });
      setRunStates((prev) => ({ ...prev, [role]: { phase: 'running' as const, activePid: pid } }));
      onRunStart?.(pid, feature.id, feature.name, command, args);

      const nextAssignments = { ...(feature.harnessAssignments ?? {}) };
      nextAssignments[role] = {
        ...nextAssignments[role],
        activePid: pid,
        status: 'running',
      };
      onFeatureUpdate?.(feature.id, { harnessAssignments: nextAssignments });

      onExecuted({ success: true, message: `${adapter.name} started (PID: ${pid})`, command, args, dryRun: false, pid });
    } catch (err) {
      setLogs((prev) => [...prev, { role, line: `Error: ${err}` }]);
      setRunStates((prev) => ({ ...prev, [role]: { phase: 'error' as const, activePid: null } }));
    }
  }, [adapters, buildAssignmentPatch, buildDagWorkflowSelection, buildExecutionPrompt, configByRole, feature, onExecuted, onFeatureUpdate, onRunEnd, onRunLog, onRunStart, projectRoot]);

  const handleDispatchAll = useCallback(async () => {
    const promises: Promise<void>[] = [];
    let skipped = 0;
    for (const role of ROLES) {
      const config = configByRole[role];
      const adapter = adapters.find((a) => a.id === config.selectedAdapterId);
      if (!adapter) { skipped++; continue; }
      if (runStates[role].phase === 'running' || runStates[role].phase === 'pending') continue;
      promises.push(dispatchRole(role));
    }
    if (skipped > 0 && skipped < 3) {
      setLogs((prev) => [...prev, { role: 'worker' as const, line: `── ${skipped} role(s) skipped — no adapter selected ──` }]);
    }
    await Promise.allSettled(promises);
  }, [adapters, configByRole, dispatchRole, runStates]);

  const handleConfirmKill = async () => {
    if (killConfirmPid == null) return;
    await killProcess(killConfirmPid);
    for (const role of ROLES) {
      if (runStates[role].activePid === killConfirmPid) {
        setRunStates((prev) => ({ ...prev, [role]: { phase: 'error' as const, activePid: null } }));
        setLogs((prev) => [...prev, { role, line: `── ${ROLE_SHORT[role]} killed (PID ${killConfirmPid}) ──` }]);
      }
    }
    setKillConfirmPid(null);
  };

  const handleOpenInTerminal = async () => {
    const config = configByRole[activeRole];
    const adapter = adapters.find((a) => a.id === config.selectedAdapterId);
    if (!adapter) return;
    try {
      const dagSelection = buildDagWorkflowSelection(activeRole, config);
      if (dagSelection) {
        await saveAgentWorkflowRun(projectRoot, dagSelection.run);
      }
      const runtimeAdapter = createRuntimeAdapterFromConfig(adapter);
      const result = await runtimeAdapter.execute({
        feature,
        prompt: await buildExecutionPrompt(activeRole, config, dagSelection),
        projectRoot,
      });
      if (!result.success || !result.command || !result.args) throw new Error(result.message ?? 'Unable to build command');
      const args = await augmentArgsWithMcp(result.command, result.args, collectEnabledMcpServers(projectRoot));
      const flatArgs = args.map((a) => a.replace(/\r?\n/g, ' '));
      await spawnTerminal({ command: result.command, args: flatArgs, cwd: projectRoot });
      const assignmentPatch = buildAssignmentPatch(activeRole, config, dagSelection);
      onFeatureUpdate?.(
        feature.id,
        activeRole === 'worker' ? { ...assignmentPatch, status: 'in_progress' } : assignmentPatch,
      );
      onExecuted({ success: true, message: `${adapter.name} opened in Terminal`, command: result.command, args: flatArgs, dryRun: false });
      onClose();
    } catch (err) {
      setLogs((prev) => [...prev, { role: activeRole, line: `Failed to open terminal: ${err}` }]);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeConfig = configByRole[activeRole];
  const activeAdapter = adapters.find((a) => a.id === activeConfig.selectedAdapterId);
  const activeTargetKind = getAdapterExecutionKind(activeAdapter);
  const isActiveAgentCli = activeTargetKind === 'agent-cli';
  const isActiveTargetBlocked = !activeAdapter;

  const anyRunning = ROLES.some((r) => runStates[r].phase === 'running' || runStates[r].phase === 'pending');
  const activeRunning = runStates[activeRole].phase === 'running';
  const activeActivePid = runStates[activeRole].activePid;

  const isAssignedBlocked =
    activeRole === 'worker' &&
    runStates.worker.phase === 'idle' &&
    !!feature.assignedTo &&
    feature.status === 'in_progress' &&
    !overrideConfirmed;

  const hasLogs = logs.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-6 py-4">
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

        {/* Body — scrollable */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Phase selector (shared) */}
          <div className="shrink-0 border-b border-stone-200/10 px-6 py-3">
            <label className="mb-1 block text-sm font-medium text-stone-200">{d.phaseLabel}</label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value as FeaturePhase)}
              className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
            >
              {PHASE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Override warning (worker only) */}
          {activeRole === 'worker' && runStates.worker.phase === 'idle' && feature.assignedTo && feature.status === 'in_progress' && !overrideConfirmed && (
            <div className="shrink-0 mx-6 mt-3 flex items-start justify-between gap-3 border border-amber-400/30 bg-amber-500/10 px-4 py-3">
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

          {/* Role config panel (scrollable) */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <RoleConfigPanel
              key={activeRole}
              role={activeRole}
              feature={feature}
              adapters={adapters}
              engineerRoles={engineerRoles}
              projectRoot={projectRoot}
              defaultIDE={defaultIDE}
              selectedPhase={selectedPhase}
              state={activeConfig}
              onStateChange={(patch) => handleConfigChange(activeRole, patch)}
            />
          </div>

          {/* Bottom sheet tabs */}
          <div className="shrink-0">
            <BottomSheetTabs
              tabs={sheetTabs}
              activeKey={activeRole}
              onSelect={setActiveRole}
            />
          </div>

          {/* Unified log panel */}
          {(hasLogs || anyRunning) && (
            <div className="shrink-0 border-t border-stone-200/12">
              <div className="flex items-center justify-between px-6 py-2">
                <label className="text-sm font-medium text-stone-200">
                  {anyRunning ? d.liveOutput : d.executionLog}
                </label>
                {anyRunning && (
                  <div className="flex gap-2 text-[10px]">
                    {ROLES.map((r) => runStates[r].activePid != null && (
                      <span key={r} className="text-stone-400">
                        {ROLE_SHORT[r]}: PID {runStates[r].activePid}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="max-h-48 overflow-auto border-t border-stone-200/8 bg-[rgb(var(--pm-input))] px-6 py-3 font-mono text-xs leading-5">
                {logs.length === 0 ? (
                  <span className="animate-pulse text-stone-500">{d.waitingOutput}</span>
                ) : (
                  logs.map((entry, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      <span className={`mr-1.5 font-semibold ${ROLE_LOG_COLOR[entry.role]}`}>
                        [{ROLE_SHORT[entry.role]}]
                      </span>
                      <span className="text-stone-200">{entry.line}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Kill confirmation */}
          {killConfirmPid != null && (
            <div className="shrink-0 border-t border-red-500/40 bg-red-950/30 px-6 py-3">
              <p className="mb-2 text-sm font-semibold text-red-200">{d.killConfirmTitle}</p>
              <p className="mb-3 text-xs text-stone-400">
                {d.killConfirmBody.replace('{pid}', String(killConfirmPid)).replace('{feature}', feature.name)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmKill}
                  className="border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950/60"
                >
                  {d.killConfirm}
                </button>
                <button
                  onClick={() => setKillConfirmPid(null)}
                  className="border border-stone-200/25 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-white/5"
                >
                  {d.killCancel}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-300 hover:bg-white/5"
          >
            {anyRunning ? d.backgroundBtn : d.closeBtn}
          </button>

          {activeRunning && activeActivePid != null && killConfirmPid == null && (
            <button
              onClick={() => setKillConfirmPid(activeActivePid)}
              className="border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40"
            >
              Kill {ROLE_SHORT[activeRole]}
            </button>
          )}

          {runStates[activeRole].phase === 'idle' && isActiveAgentCli && (
            <button
              onClick={handleOpenInTerminal}
              disabled={isAssignedBlocked || isActiveTargetBlocked}
              className="border border-stone-200/25 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-white/5 disabled:opacity-50"
            >
              {d.openTerminalBtn}
            </button>
          )}

          {runStates[activeRole].phase === 'idle' && adapters.length > 0 && (
            <button
              onClick={() => dispatchRole(activeRole)}
              disabled={isAssignedBlocked || isActiveTargetBlocked || !activeAdapter}
              className="border border-emerald-200/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              Dispatch {ROLE_SHORT[activeRole]}
            </button>
          )}

          {adapters.length > 0 && (
            <button
              onClick={handleDispatchAll}
              disabled={ROLES.every((r) => runStates[r].phase === 'running' || runStates[r].phase === 'pending')}
              className="bg-stone-100 px-4 py-2 text-sm font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100 disabled:opacity-50"
            >
              Dispatch All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
