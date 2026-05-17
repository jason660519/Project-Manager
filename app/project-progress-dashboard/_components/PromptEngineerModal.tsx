'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import Link from 'next/link';
import type { AgentAdapterConfig, FeaturePromptConfig } from '../../../lib/types';
import type { PhaseRow } from '../_lib/phaseRows';

interface PromptEngineerModalProps {
  open: boolean;
  onClose: () => void;
  row: PhaseRow | null;
  agents: AgentAdapterConfig[];
  /** Persist a prompt config change for the row's underlying feature (or custom row). */
  onSave: (row: PhaseRow, config: FeaturePromptConfig) => void;
}

export function PromptEngineerModal({ open, onClose, row, agents, onSave }: PromptEngineerModalProps) {
  const [body, setBody] = useState('');
  const [agentId, setAgentId] = useState('');
  const [autoLoop, setAutoLoop] = useState(false);
  const [stopCondition, setStopCondition] = useState('');
  const [maxIterations, setMaxIterations] = useState<number>(5);

  useEffect(() => {
    if (!row) return;
    const seed = row.feature?.promptConfig;
    setBody(seed?.body ?? '');
    setAgentId(seed?.agentId ?? agents[0]?.id ?? '');
    setAutoLoop(seed?.autoLoop ?? false);
    setStopCondition(seed?.stopCondition ?? '');
    setMaxIterations(seed?.maxIterations ?? 5);
  }, [row, agents]);

  if (!open || !row) return null;

  const submit = () => {
    onSave(row, {
      body: body.trim() || undefined,
      agentId: agentId || undefined,
      autoLoop,
      stopCondition: stopCondition.trim() || undefined,
      maxIterations,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded border border-stone-200/20 bg-[#061512] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-100">
              Prompt engineer
            </h2>
            <p className="text-[11px] text-stone-400">{row.id} · {row.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/project-progress-dashboard/task?rowId=${encodeURIComponent(row.id)}`}
              className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200"
            >
              <ExternalLink size={12} /> Open full page
            </Link>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-100"><X size={16} /></button>
          </div>
        </div>
        <div className="space-y-3 text-xs text-stone-200">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">Prompt body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Describe what the agent should do for this feature…"
              className="w-full rounded border border-stone-200/15 bg-[#020a09]/95 p-2 text-xs text-stone-100 focus:outline-none focus:border-emerald-400/40"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">Agent</span>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="h-7 w-full rounded border border-stone-200/15 bg-[#061512] px-2 text-xs text-stone-100"
              >
                {agents.length === 0 && <option value="">(no agents configured)</option>}
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">Max iterations</span>
              <input
                type="number" min={1} max={50}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="h-7 w-full rounded border border-stone-200/15 bg-[#061512] px-2 text-xs text-stone-100"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-200">
            <input
              type="checkbox"
              checked={autoLoop}
              onChange={(e) => setAutoLoop(e.target.checked)}
              className="accent-emerald-400"
            />
            Auto-loop until stop condition matches the last run output
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-stone-400">Stop condition</span>
            <input
              value={stopCondition}
              onChange={(e) => setStopCondition(e.target.value)}
              placeholder="e.g. 'all tests pass' (substring match)"
              className="h-7 w-full rounded border border-stone-200/15 bg-[#061512] px-2 text-xs text-stone-100"
              disabled={!autoLoop}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-stone-200/15 px-3 py-1.5 text-xs text-stone-300">Cancel</button>
          <button onClick={submit} className="rounded bg-emerald-500/30 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/40">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
