'use client';

import { useState } from 'react';
import { Activity, Bot, ChevronDown, ChevronUp, Cpu, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import type { ActiveRun, AnyAdapterConfig } from '../../../lib/types';

interface AgentOpsPanelProps {
  adapters: AnyAdapterConfig[];
  activeRuns: ActiveRun[];
}

/**
 * Project Manager flavour of the Paperclip AgentOpsPanel. It shows the
 * configured adapters (agents + IDEs) and whether any of them are currently
 * executing a run. Resume/Pause/Switch don't have an in-app equivalent here,
 * so the action slot links to the Plugins page where adapters are managed.
 */
export function AgentOpsPanel({ adapters, activeRuns }: AgentOpsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const agents = adapters.filter((a) => a.type === 'agent');
  const ides = adapters.filter((a) => a.type === 'ide');
  const busyByCommand = new Set(activeRuns.map((r) => r.command));

  return (
    <div className="rounded border border-stone-200/15 bg-[#0a2622]/70">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-300" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-100">
            Agents ({agents.length})
          </span>
          <span className="text-[11px] text-stone-400">
            · {activeRuns.length} running
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>
      {expanded && (
        <div className="border-t border-stone-200/15 p-2">
          {[...agents, ...ides].length === 0 ? (
            <p className="text-[11px] text-stone-500">No adapters configured.</p>
          ) : (
            <div className="grid gap-1">
              {[...agents, ...ides].map((a) => {
                const busy = busyByCommand.has(a.command);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded border border-stone-200/10 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      {a.type === 'agent'
                        ? <Bot size={14} className="text-emerald-300" />
                        : <Cpu size={14} className="text-cyan-300" />}
                      <div>
                        <p className="text-[12px] font-medium text-stone-100">{a.name}</p>
                        <p className="text-[10px] text-stone-400">{a.command}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                        busy
                          ? 'border-amber-300/30 bg-amber-500/15 text-amber-200'
                          : 'border-emerald-300/30 bg-emerald-500/15 text-emerald-200',
                      )}>{busy ? 'running' : 'idle'}</span>
                      <Link
                        href="/plugins"
                        className="flex h-6 w-6 items-center justify-center rounded border border-stone-200/15 text-stone-300 hover:text-stone-100 hover:bg-white/10"
                        title="Configure adapter"
                      >
                        <Settings2 size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
