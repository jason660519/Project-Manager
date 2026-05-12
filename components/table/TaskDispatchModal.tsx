'use client';

import React, { useEffect, useRef, useState } from 'react';
import { killProcess, onAgentExit, onAgentStdout, readFile, spawnAgent } from '../../lib/bridge';
import { AgentAdapterConfig, AnyAdapterConfig, EngineerRole, ExecutionResult, Feature } from '../../lib/types';

// ── Prompt templates ──────────────────────────────────────────────────────────

interface PromptTemplate {
  label: string;
  build: (feature: Feature, specContent?: string) => string;
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    label: '從零實作',
    build: (f, spec) =>
      `請根據 Spec 從頭實作 [${f.id}] ${f.name}。\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}\n` +
      (f.notes ? `備註：${f.notes}\n` : '') +
      (spec ? `\n--- Spec 內容 ---\n${spec.slice(0, 1500)}` : ''),
  },
  {
    label: '補測試',
    build: (f) =>
      `請為 [${f.id}] ${f.name} 的現有實作補齊單元測試與整合測試。\n` +
      `測試路徑：${f.paths.unitIntegrationTest ?? f.paths.test ?? '未指定'}\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}`,
  },
  {
    label: 'Debug',
    build: (f) =>
      `[${f.id}] ${f.name} 目前有 bug，請找出根本原因並修復。\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}\n` +
      `目前進度：${f.progress}%`,
  },
  {
    label: 'Code Review',
    build: (f) =>
      `請 review [${f.id}] ${f.name} 的實作並給出具體改善建議。\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}`,
  },
  {
    label: '文件補全',
    build: (f) =>
      `請為 [${f.id}] ${f.name} 補充完整的 JSDoc 與型別說明。\n` +
      `實作路徑：${f.paths.implementation ?? '未指定'}`,
  },
];

function resolvePath(filePath: string, projectRoot: string): string {
  if (filePath.startsWith('/')) return filePath;
  return `${projectRoot.replace(/\/$/, '')}/${filePath}`;
}

function buildDefaultPrompt(feature: Feature, specContent?: string): string {
  let text = `請幫我處理 [${feature.id}] ${feature.name} 的開發工作。\n`;
  text += `狀態：${feature.status}（${feature.progress}%）\n`;
  text += `實作路徑：${feature.paths.implementation ?? '未指定'}\n`;
  if (feature.notes) text += `備註：${feature.notes}\n`;
  if (specContent) {
    text += `\n--- Spec 內容（前段）---\n${specContent.slice(0, 1500)}`;
  }
  return text;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TaskDispatchModalProps {
  feature: Feature;
  adapters: AnyAdapterConfig[];
  projectRoot: string;
  engineerRoles?: EngineerRole[];
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
  onFeatureUpdate?: (
    featureId: string,
    update: Partial<Pick<Feature, 'status' | 'progress'>>,
  ) => void;
}

type Phase = 'idle' | 'running' | 'done' | 'error';

export function TaskDispatchModal({
  feature,
  adapters,
  projectRoot,
  engineerRoles = [],
  onClose,
  onExecuted,
  onRunStart,
  onRunLog,
  onRunEnd,
  onFeatureUpdate,
}: TaskDispatchModalProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedAdapterId, setSelectedAdapterId] = useState(adapters[0]?.id ?? '');
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [activePid, setActivePid] = useState<number | null>(null);
  const [specLoading, setSpecLoading] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<Array<() => void>>([]);
  const activePidRef = useRef<number | null>(null);

  const selectedAdapter = adapters.find((a) => a.id === selectedAdapterId);
  const isIDE = selectedAdapter?.type === 'ide';
  const selectedRole = engineerRoles.find((r) => r.id === selectedRoleId) ?? null;

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const role = engineerRoles.find((r) => r.id === roleId);
    if (role?.defaultAgentId) {
      const match = adapters.find((a) => a.id === role.defaultAgentId);
      if (match) setSelectedAdapterId(match.id);
    }
  };

  // Load spec content and build default prompt on mount
  useEffect(() => {
    let cancelled = false;
    const specPath = feature.paths.spec ?? feature.paths.tdd;

    if (!specPath) {
      setPrompt(buildDefaultPrompt(feature));
      return;
    }

    setSpecLoading(true);
    readFile(resolvePath(specPath, projectRoot))
      .then((content) => {
        if (!cancelled) setPrompt(buildDefaultPrompt(feature, content || undefined));
      })
      .catch(() => {
        if (!cancelled) setPrompt(buildDefaultPrompt(feature));
      })
      .finally(() => {
        if (!cancelled) setSpecLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feature, projectRoot]);

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

  const buildCommand = (adapter: AnyAdapterConfig): { command: string; args: string[] } => {
    if (adapter.type === 'ide') {
      const filePath =
        feature.paths.implementation ?? feature.paths.tdd ?? feature.paths.spec ?? '.';
      return { command: adapter.command, args: [resolvePath(filePath, projectRoot)] };
    }
    const agent = adapter as AgentAdapterConfig;

    let effectivePrompt = prompt;
    if (selectedRole) {
      const parts: string[] = [];
      if (selectedRole.systemPrompt) {
        parts.push(`[工程師角色: ${selectedRole.name}]\n${selectedRole.systemPrompt}`);
      }
      if (selectedRole.referenceFiles.length > 0) {
        parts.push(`參考文件:\n${selectedRole.referenceFiles.map((f) => `- ${f}`).join('\n')}`);
      }
      if (parts.length > 0) {
        effectivePrompt = `${parts.join('\n\n')}\n\n---\n\n${prompt}`;
      }
    }

    const args = agent.argsTemplate.map((arg) =>
      arg
        .replaceAll('{prompt}', effectivePrompt)
        .replaceAll('{featureId}', feature.id)
        .replaceAll('{root}', projectRoot),
    );
    return { command: agent.command, args };
  };

  const handleExecute = async () => {
    const adapter = adapters.find((a) => a.id === selectedAdapterId);
    if (!adapter) return;

    setPhase('running');
    setLogs([]);

    onFeatureUpdate?.(feature.id, { status: 'in_progress' });

    const { command, args } = buildCommand(adapter);

    try {
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
        message: `${adapter.name} 已啟動 (PID: ${pid})`,
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

  const handleKill = async () => {
    if (activePid == null) return;
    await killProcess(activePid);
    setActivePid(null);
    activePidRef.current = null;
  };

  const isRunning = phase === 'running';

  // Target file display for IDE adapters
  const ideTargetFile =
    feature.paths.implementation ?? feature.paths.tdd ?? feature.paths.spec ?? '.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-xl flex-col overflow-hidden border border-stone-200/18 bg-[#071d1a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-stone-50">任務派遣</h3>
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
          {phase === 'idle' && (
            <>
              {/* Engineer role selector */}
              {engineerRoles.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-200">
                    工程師角色
                  </label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                  >
                    <option value="">— 不套用角色 —</option>
                    {engineerRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {selectedRole && (
                    <div className="mt-1.5 border border-stone-200/12 bg-[#061512]/60 px-3 py-2 text-[11px] text-stone-400">
                      <span className="text-stone-300">系統提示：</span>
                      {selectedRole.systemPrompt.slice(0, 80)}…
                      {selectedRole.referenceFiles.length > 0 && (
                        <span className="ml-2 text-stone-500">
                          · 參考：{selectedRole.referenceFiles.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Adapter selector */}
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-200">
                  執行環境 / Agent
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
              </div>

              {isIDE ? (
                /* IDE mode: show target file, no prompt needed */
                <div className="border border-stone-200/12 bg-[#03100f] p-3">
                  <p className="mb-1.5 text-xs font-medium text-stone-400">開啟檔案</p>
                  <p className="break-all font-mono text-xs text-stone-200">{ideTargetFile}</p>
                </div>
              ) : (
                /* Agent mode: template picker + prompt textarea */
                <>
                  <div>
                    <p className="mb-2 text-xs font-medium text-stone-400">快選模板</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PROMPT_TEMPLATES.map((tpl) => (
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
                      開發指令 (Prompt)
                      {specLoading && (
                        <span className="ml-2 animate-pulse text-xs font-normal text-stone-500">
                          載入 Spec…
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
            </>
          )}

          {phase !== 'idle' && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-stone-200">
                  {isRunning ? 'Live Output' : 'Execution Log'}
                </label>
                {activePid != null && (
                  <span className="text-xs text-stone-400">PID {activePid}</span>
                )}
              </div>
              <div className="max-h-64 overflow-auto border border-stone-200/12 bg-[#03100f] p-3 font-mono text-xs leading-5 text-stone-200">
                {logs.length === 0 ? (
                  <span className="animate-pulse text-stone-500">Waiting for output…</span>
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
            {isRunning ? '背景執行' : '關閉'}
          </button>
          {isRunning && activePid != null && (
            <button
              onClick={handleKill}
              className="border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40"
            >
              Kill
            </button>
          )}
          {phase === 'idle' && (
            <button
              onClick={handleExecute}
              disabled={specLoading}
              className="bg-stone-100 px-4 py-2 text-sm font-medium text-[#071d1a] hover:bg-amber-100 disabled:opacity-50"
            >
              確認派遣
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
