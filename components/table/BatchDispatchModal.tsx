'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import {
  augmentArgsWithMcp,
  killProcess,
  mcpInjectionFlag,
  onAgentExit,
  onAgentStdout,
  spawnAgent,
} from '../../lib/bridge';
import {
  DEFAULT_AGENT_WORKFLOWS,
  buildAgentWorkflowPrompt,
  getAgentWorkflowById,
} from '../../lib/agent-workflows';
import { collectEnabledMcpServers } from '../../lib/storage/plugins';
import { useI18n } from '../../lib/i18n';
import { AgentAdapterConfig, AnyAdapterConfig, Feature } from '../../lib/types';

// ── Batch prompt templates ────────────────────────────────────────────────────

const BATCH_TEMPLATES = [
  {
    label: '從零實作',
    build: (f: Feature) =>
      `請根據 Spec 從頭實作 [${f.id}] ${f.name}。\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}` +
      (f.notes ? `\n備註：${f.notes}` : ''),
  },
  {
    label: '補測試',
    build: (f: Feature) =>
      `請為 [${f.id}] ${f.name} 補齊單元測試與整合測試。\n` +
      `測試路徑：${f.paths.unitIntegrationTest ?? f.paths.test ?? '未指定'}\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}`,
  },
  {
    label: 'Debug',
    build: (f: Feature) =>
      `[${f.id}] ${f.name} 有 bug，請找出並修復。\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}\n` +
      `目前進度：${f.progress}%`,
  },
  {
    label: 'Code Review',
    build: (f: Feature) =>
      `請 review [${f.id}] ${f.name} 的實作並給出改善建議。\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}`,
  },
  {
    label: '文件補全',
    build: (f: Feature) =>
      `請為 [${f.id}] ${f.name} 補充 JSDoc 與型別說明。\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}`,
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface BatchItem {
  feature: Feature;
  phase: 'pending' | 'running' | 'done' | 'error';
  pid?: number;
  logs: string[];
}

type BatchPhase = 'idle' | 'running' | 'done';

interface BatchDispatchModalProps {
  features: Feature[];
  adapters: AnyAdapterConfig[];
  projectRoot: string;
  onClose: () => void;
  onRunStart?: (
    pid: number,
    featureId: string,
    featureName: string,
    command: string,
    args: string[],
  ) => void;
  onRunLog?: (pid: number, line: string) => void;
  onRunEnd?: (pid: number, exitCode: number) => void;
  onFeatureUpdate?: (
    featureId: string,
    update: Partial<Pick<Feature, 'status' | 'progress'>>,
  ) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BatchDispatchModal({
  features,
  adapters,
  projectRoot,
  onClose,
  onRunStart,
  onRunLog,
  onRunEnd,
  onFeatureUpdate,
}: BatchDispatchModalProps) {
  const { t } = useI18n();
  const d = t.dispatch;
  const agentAdapters = adapters.filter((a) => a.type === 'agent');
  const emptyState = features.length === 0;

  const [selectedAdapterId, setSelectedAdapterId] = useState(agentAdapters[0]?.id ?? '');
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [batchPhase, setBatchPhase] = useState<BatchPhase>('idle');
  const [items, setItems] = useState<BatchItem[]>(
    features.map((f) => ({ feature: f, phase: 'pending', logs: [] })),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [killConfirmBatchPid, setKillConfirmBatchPid] = useState<number | null>(null);
  const killBatchPidRef = useRef<number | null>(null);

  const unlistenRefs = useRef<Array<() => void>>([]);

  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach((fn) => fn());
    };
  }, []);

  const adapter = agentAdapters.find((a) => a.id === selectedAdapterId);
  const selectedWorkflow = selectedWorkflowId ? getAgentWorkflowById(selectedWorkflowId) ?? null : null;

  const mcpServerCount = adapter
    ? Object.keys(collectEnabledMcpServers(projectRoot)).length
    : 0;
  const mcpFlag = adapter ? mcpInjectionFlag(adapter.command) : null;
  const mcpInjection = mcpFlag && mcpServerCount > 0 ? { count: mcpServerCount, flag: mcpFlag } : null;

  const buildArgs = (feature: Feature): string[] => {
    if (!adapter) return [];
    const agent = adapter as AgentAdapterConfig;
    const basePrompt = BATCH_TEMPLATES[selectedTemplate].build(feature);
    const prompt = selectedWorkflow
      ? buildAgentWorkflowPrompt(selectedWorkflow, feature, basePrompt)
      : basePrompt;
    return agent.argsTemplate.map((arg) =>
      arg
        .replaceAll('{prompt}', prompt)
        .replaceAll('{featureId}', feature.id)
        .replaceAll('{root}', projectRoot),
    );
  };

  const handleDispatchAll = async () => {
    if (!adapter) return;
    setBatchPhase('running');

    // Same MCP config is reused across every feature in this batch, so build
    // it once before spawning instead of per-feature.
    const mcpServers = collectEnabledMcpServers(projectRoot);

    // Map pid → featureId for event routing
    const pidToFeatureId = new Map<number, string>();

    const unStdout = await onAgentStdout(({ pid: eventPid, line }) => {
      const featureId = pidToFeatureId.get(eventPid);
      if (!featureId) return;
      setItems((prev) =>
        prev.map((item) =>
          item.feature.id === featureId ? { ...item, logs: [...item.logs, line] } : item,
        ),
      );
      onRunLog?.(eventPid, line);
    });

    const unExit = await onAgentExit(({ pid: exitPid, code }) => {
      const featureId = pidToFeatureId.get(exitPid);
      if (!featureId) return;
      const succeeded = code === 0;
      setItems((prev) =>
        prev.map((item) =>
          item.feature.id === featureId
            ? {
                ...item,
                phase: succeeded ? 'done' : 'error',
                pid: undefined,
                logs: [...item.logs, `\n── exited (code ${code}) ──`],
              }
            : item,
        ),
      );
      onRunEnd?.(exitPid, code);
      if (succeeded) {
        const feature = features.find((f) => f.id === featureId);
        if (feature) {
          onFeatureUpdate?.(featureId, { progress: Math.min(feature.progress + 20, 100) });
        }
      }
    });

    unlistenRefs.current.push(unStdout, unExit);

    // Spawn all processes in parallel
    await Promise.all(
      items.map(async (item) => {
        const { feature } = item;
        try {
          const baseArgs = buildArgs(feature);
          const args = await augmentArgsWithMcp(adapter.command, baseArgs, mcpServers);
          onFeatureUpdate?.(feature.id, { status: 'in_progress' });
          const pid = await spawnAgent({ command: adapter.command, args, workingDir: projectRoot });
          pidToFeatureId.set(pid, feature.id);
          setItems((prev) =>
            prev.map((i) =>
              i.feature.id === feature.id ? { ...i, phase: 'running', pid } : i,
            ),
          );
          onRunStart?.(pid, feature.id, feature.name, adapter.command, args);
        } catch (err) {
          setItems((prev) =>
            prev.map((i) =>
              i.feature.id === feature.id
                ? { ...i, phase: 'error', logs: [`Error: ${err}`] }
                : i,
            ),
          );
        }
      }),
    );

    setBatchPhase('done');
  };

  const handleRequestBatchKill = (pid: number, featureName: string) => {
    killBatchPidRef.current = pid;
    setKillConfirmBatchPid(pid);
  };

  const handleConfirmBatchKill = async (pid: number) => {
    await killProcess(pid);
    setKillConfirmBatchPid(null);
    killBatchPidRef.current = null;
    // Remove the PID from the item, updating its phase to 'done' with a kill note
    setItems((prev) =>
      prev.map((item) =>
        item.pid === pid
          ? { ...item, pid: undefined, phase: 'done' as const, logs: [...item.logs, '── killed by user ──'] }
          : item,
      ),
    );
  };

  const handleCancelBatchKill = () => {
    setKillConfirmBatchPid(null);
    killBatchPidRef.current = null;
  };

  const doneCount = items.filter((i) => i.phase === 'done').length;
  const errorCount = items.filter((i) => i.phase === 'error').length;
  const runningCount = items.filter((i) => i.phase === 'running').length;
  const pendingCount = items.filter((i) => i.phase === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden border border-stone-200/18 bg-[rgb(var(--pm-panel))] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-stone-50">批次派遣</h3>
            <p className="text-xs text-stone-400">{features.length} 個功能 · 同時執行</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-stone-400 hover:text-stone-100"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 overflow-y-auto p-6" style={{ maxHeight: '70vh' }}>
          {emptyState && batchPhase === 'idle' && (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-stone-400">{d.batchEmptyTitle}</p>
              <p className="mt-1 text-xs text-stone-500">{d.batchEmptyHint}</p>
            </div>
          )}

          {!emptyState && batchPhase === 'idle' && (
            <>
              {/* Agent selector (only shown when multiple agents exist) */}
              {agentAdapters.length > 1 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-200">Agent</label>
                  <select
                    value={selectedAdapterId}
                    onChange={(e) => setSelectedAdapterId(e.target.value)}
                    className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none"
                  >
                    {agentAdapters.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Workflow selector */}
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-200">
                  Agent Workflow
                </label>
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  className="w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none"
                >
                  <option value="">— 一般批次派遣，不套用 workflow —</option>
                  {DEFAULT_AGENT_WORKFLOWS.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name} · {workflow.mode}
                    </option>
                  ))}
                </select>
                {selectedWorkflow && (
                  <div className="mt-1.5 border border-stone-200/12 bg-[rgb(var(--pm-rail))]/60 px-3 py-2 text-[11px] text-stone-400">
                    <span className="border border-amber-200/25 px-1.5 py-0.5 font-mono uppercase tracking-[0.12em] text-amber-200/80">
                      {selectedWorkflow.mode}
                    </span>
                    <span className="ml-2 text-stone-300">{selectedWorkflow.role}</span>
                    <span className="ml-2">{selectedWorkflow.summary}</span>
                  </div>
                )}
              </div>

              {mcpInjection && (
                <p className="text-[11px] text-emerald-300/80">
                  + {mcpInjection.count} MCP server{mcpInjection.count > 1 ? 's' : ''} 將透過{' '}
                  <span className="font-mono">{mcpInjection.flag}</span> 注入每一個派遣
                </p>
              )}

              {/* Task template selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-200">任務模板</label>
                <div className="flex flex-wrap gap-1.5">
                  {BATCH_TEMPLATES.map((tpl, i) => (
                    <button
                      key={tpl.label}
                      onClick={() => setSelectedTemplate(i)}
                      className={`border px-3 py-1.5 text-xs transition-colors ${
                        selectedTemplate === i
                          ? 'border-emerald-200/40 bg-emerald-100/15 text-emerald-100'
                          : 'border-stone-200/20 text-stone-400 hover:border-stone-200/40 hover:text-stone-200'
                      }`}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  每個功能會以其自身的路徑與 ID 填入模板後獨立派遣
                </p>
              </div>
            </>
          )}

          {/* Progress summary (visible when running/done) */}
          {batchPhase !== 'idle' && (
            <div className="flex items-center gap-4 text-xs">
              {doneCount > 0 && <span className="text-emerald-400">{doneCount} 完成</span>}
              {errorCount > 0 && <span className="text-red-400">{errorCount} 失敗</span>}
              {runningCount > 0 && <span className="text-amber-400">{runningCount} 執行中</span>}
              {pendingCount > 0 && <span className="text-stone-500">{pendingCount} 等待中</span>}
            </div>
          )}

          {/* Kill confirmation dialog */}
          {killConfirmBatchPid != null && (
            <div className="border border-red-500/40 bg-red-950/30 px-4 py-3">
              <p className="mb-2 text-sm font-semibold text-red-200">
                {d.killConfirmTitle}
              </p>
              <p className="mb-3 text-xs text-stone-400">
                {d.killConfirmBody
                  .replace('{pid}', String(killConfirmBatchPid))
                  .replace('{feature}', items.find(i => i.pid === killConfirmBatchPid)?.feature.name ?? '')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirmBatchKill(killConfirmBatchPid)}
                  className="border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950/60"
                >
                  {d.killConfirm}
                </button>
                <button
                  onClick={handleCancelBatchKill}
                  className="border border-stone-200/25 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-white/5"
                >
                  {d.killCancel}
                </button>
              </div>
            </div>
          )}

          {/* Feature list */}
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.feature.id} className="border border-stone-200/12 bg-[rgb(var(--pm-input))]/50">
                <div
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                  onClick={() =>
                    setExpandedId(expandedId === item.feature.id ? null : item.feature.id)
                  }
                >
                  {item.phase === 'pending' && (
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-stone-400/40" />
                  )}
                  {item.phase === 'running' && (
                    <Loader2 size={14} className="shrink-0 animate-spin text-amber-400" />
                  )}
                  {item.phase === 'done' && (
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                  )}
                  {item.phase === 'error' && (
                    <XCircle size={14} className="shrink-0 text-red-400" />
                  )}
                  {item.phase === 'error' && item.logs.some(l => l.startsWith('Error:')) && (
                    <span className="max-w-[200px] truncate text-xs text-red-300">
                      {item.logs.find(l => l.startsWith('Error:'))}
                    </span>
                  )}
                  <span className="font-mono text-xs text-stone-500">[{item.feature.id}]</span>
                  <span className="flex-1 text-sm text-stone-200">{item.feature.name}</span>
                  {item.pid != null && (
                    <>
                      <span className="text-xs text-stone-500">PID {item.pid}</span>
                      {killConfirmBatchPid == null && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestBatchKill(item.pid!, item.feature.name);
                          }}
                          className="border border-red-500/40 px-2 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-950/40"
                        >
                          Kill
                        </button>
                      )}
                    </>
                  )}
                  {item.logs.length > 0 && (
                    <span className="text-xs text-stone-600">
                      {expandedId === item.feature.id ? '▲' : '▼'}
                    </span>
                  )}
                </div>
                {expandedId === item.feature.id && item.logs.length > 0 && (
                  <div className="border-t border-stone-200/10 p-3">
                    <div className="max-h-32 overflow-auto font-mono text-xs leading-5 text-stone-400">
                      {item.logs.slice(-30).map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap break-all">
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-stone-200/12 bg-white/[0.035] px-6 py-4">
          {!emptyState && batchPhase === 'idle' && agentAdapters.length === 0 && (
            <p className="mr-auto text-xs text-stone-500">批次派遣需要至少一個 Agent 適配器</p>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-300 hover:bg-white/5"
          >
            {'關閉'}
          </button>
          {!emptyState && batchPhase === 'idle' && agentAdapters.length > 0 && (
            <button
              onClick={handleDispatchAll}
              className="bg-stone-100 px-4 py-2 text-sm font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100"
            >
              開始批次派遣
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
