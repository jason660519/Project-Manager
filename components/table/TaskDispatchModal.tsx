'use client';

import React, { useEffect, useRef, useState } from 'react';
import { killProcess, onAgentExit, onAgentStdout, spawnAgent } from '../../lib/bridge';
import {
  AgentAdapterConfig,
  AnyAdapterConfig,
  ExecutionResult,
  Feature,
} from '../../lib/types';

interface TaskDispatchModalProps {
  feature: Feature;
  adapters: AnyAdapterConfig[];
  projectRoot: string;
  onClose: () => void;
  onExecuted: (result: ExecutionResult) => void;
}

type Phase = 'idle' | 'running' | 'done' | 'error';

export function TaskDispatchModal({
  feature,
  adapters,
  projectRoot,
  onClose,
  onExecuted,
}: TaskDispatchModalProps) {
  const [selectedAdapterId, setSelectedAdapterId] = useState(adapters[0]?.id ?? '');
  const [prompt, setPrompt] = useState(
    `請幫我處理 [${feature.id}] ${feature.name} 的開發工作。\n相關路徑：${feature.paths.implementation ?? '未指定'}`,
  );
  const [phase, setPhase] = useState<Phase>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [activePid, setActivePid] = useState<number | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<Array<() => void>>([]);

  // Auto-scroll log panel
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach((fn) => fn());
    };
  }, []);

  const buildCommand = (adapter: AnyAdapterConfig): { command: string; args: string[] } => {
    if (adapter.type === 'ide') {
      const filePath =
        feature.paths.implementation ?? feature.paths.tdd ?? feature.paths.spec ?? '.';
      return { command: adapter.command, args: [filePath] };
    }
    const agent = adapter as AgentAdapterConfig;
    const args = agent.argsTemplate.map((arg) =>
      arg
        .replaceAll('{prompt}', prompt)
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

    const { command, args } = buildCommand(adapter);

    try {
      // Register listeners before spawning to avoid missing early output
      const unStdout = await onAgentStdout(({ line }) => {
        setLogs((prev) => [...prev, line]);
      });
      const unExit = await onAgentExit(({ pid, code }) => {
        setLogs((prev) => [
          ...prev,
          `\n── process exited (PID ${pid}, code ${code}) ──`,
        ]);
        setPhase('done');
        setActivePid(null);
      });
      unlistenRefs.current.push(unStdout, unExit);

      const pid = await spawnAgent({ command, args, workingDir: projectRoot });
      setActivePid(pid);

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
  };

  const isRunning = phase === 'running';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-xl flex-col overflow-hidden border border-stone-200/18 bg-[#071d1a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-stone-50">任務派遣</h3>
            <p className="text-xs text-stone-400">
              Feature: {feature.id} — {feature.name}
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

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-200">
                  開發指令 (Prompt)
                </label>
                <textarea
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35"
                />
              </div>
            </>
          )}

          {/* Live log panel shown during / after execution */}
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
              className="bg-stone-100 px-4 py-2 text-sm font-medium text-[#071d1a] hover:bg-amber-100"
            >
              確認派遣
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
