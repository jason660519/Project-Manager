'use client';

/**
 * Eight-module autonomous-agent architecture reference for the Edit Engineer Role sheet.
 * Maps each spoke to fields in EngineerDetailSheet and shows configured vs gap status.
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, Circle } from 'lucide-react';

import type { AnyAdapterConfig, CapabilityKind, RoleCapability } from '../../../../lib/types';

export type AgentArchFormSlice = {
  defaultAgentId: string;
  systemPrompt: string;
  skills: string;
  scopePaths: string[];
  scopeMode: 'soft' | 'strict';
  capabilities: RoleCapability[];
  testPrompt: string;
  primaryProviderId: string;
  fallbacksCount: number;
};

type ModuleStatus = 'configured' | 'partial' | 'platform' | 'gap';

interface AgentModule {
  id: string;
  en: string;
  zh: string;
  fieldLabel: string;
  sectionId: string;
  status: ModuleStatus;
  statusNote: string;
}

function skillCount(skills: string): number {
  return skills.split('\n').map((s) => s.trim()).filter(Boolean).length;
}

function capabilityCount(caps: RoleCapability[], kinds?: CapabilityKind[]): number {
  if (!kinds) return caps.length;
  return caps.filter((c) => kinds.includes(c.kind)).length;
}

function deriveModules(form: AgentArchFormSlice, agents: AnyAdapterConfig[]): AgentModule[] {
  const agent = agents.find((a) => a.id === form.defaultAgentId);
  const hasAgent = Boolean(form.defaultAgentId);
  const hasPrompt = form.systemPrompt.trim().length > 0;
  const hasSkills = skillCount(form.skills) > 0;
  const hasScope = form.scopePaths.length > 0;
  const hasModel = Boolean(form.primaryProviderId) || form.fallbacksCount > 0;
  const handsAssigned = capabilityCount(form.capabilities, ['hands']) > 0;
  const sensesAssigned = capabilityCount(form.capabilities, [
    'eyes',
    'voice-tts',
    'voice-stt',
    'recording',
  ]);
  const hasTestPrompt = form.testPrompt.trim().length > 0;

  return [
    {
      id: 'loop',
      en: 'LOOP',
      zh: '循環控制',
      fieldLabel: 'Default Agent',
      sectionId: 'engineer-section-loop',
      status: hasAgent ? 'configured' : 'gap',
      statusNote: hasAgent
        ? agent?.name ?? 'Agent selected'
        : 'Pick an agent so dispatches can iterate autonomously',
    },
    {
      id: 'hooks',
      en: 'HOOKS',
      zh: 'Pre / Post / Stop',
      fieldLabel: 'Runtime + PM skills',
      sectionId: 'engineer-section-capabilities',
      status: 'platform',
      statusNote: 'Cursor hooks & PM skills (investigate, ship) — platform-level, not per role',
    },
    {
      id: 'state',
      en: 'STATE M.',
      zh: '狀態機',
      fieldLabel: 'Working Scope · mode',
      sectionId: 'engineer-section-scope',
      status: hasScope ? (form.scopeMode === 'strict' ? 'configured' : 'partial') : 'partial',
      statusNote: hasScope
        ? `${form.scopePaths.length} path(s) · ${form.scopeMode}`
        : 'Add allowed paths so the agent knows its phase boundaries',
    },
    {
      id: 'evaluator',
      en: 'EVALUATOR',
      zh: '評估器',
      fieldLabel: 'AI Provider Test',
      sectionId: 'engineer-section-test',
      status: hasTestPrompt ? 'configured' : 'partial',
      statusNote: hasTestPrompt
        ? 'Custom test prompt saved'
        : 'Run Test uses auto prompt — add criteria to catch bad replies',
    },
    {
      id: 'stop',
      en: 'STOP POLICY',
      zh: '停 / 繼續',
      fieldLabel: 'Dispatch + verification',
      sectionId: 'engineer-section-model',
      status: hasModel ? 'partial' : 'platform',
      statusNote: hasModel
        ? 'Primary + fallbacks set — runtime still enforces ship / verify stop rules'
        : 'Stop when goal met, budget exhausted, or verify baseline fails (ship skill)',
    },
    {
      id: 'subagent',
      en: 'SUBAGENT',
      zh: '子代理委派',
      fieldLabel: 'Default Agent runtime',
      sectionId: 'engineer-section-loop',
      status: hasAgent ? 'configured' : 'gap',
      statusNote: hasAgent
        ? 'Task / subagent delegation follows the selected CLI adapter'
        : 'Without an agent adapter, fan-out delegation is unavailable',
    },
    {
      id: 'context',
      en: 'CONTEXT',
      zh: '注入 / 壓縮',
      fieldLabel: 'System Prompt · Skills · Scope',
      sectionId: 'engineer-section-context',
      status:
        hasPrompt && hasSkills
          ? 'configured'
          : hasPrompt || hasSkills
            ? 'partial'
            : 'gap',
      statusNote:
        hasPrompt && hasSkills
          ? 'Prompt + skills injected on every dispatch'
          : hasPrompt
            ? 'Add skills so the model knows its toolkit'
            : hasSkills
              ? 'Add a system prompt for operating context'
              : 'Context injection is empty — agent may drift',
    },
    {
      id: 'tools',
      en: 'TOOLS / MCP',
      zh: '工具與協議',
      fieldLabel: 'Capabilities · Ability / Tools',
      sectionId: 'engineer-section-capabilities',
      status:
        handsAssigned && sensesAssigned
          ? 'configured'
          : handsAssigned || sensesAssigned
            ? 'partial'
            : 'gap',
      statusNote: handsAssigned
        ? sensesAssigned
          ? 'Hands + perception capabilities assigned'
          : 'Hands assigned — consider Eyes / Recording for observability'
        : 'Assign passed Hands + MCP candidates from Integrations Hub',
    },
  ];
}

const STATUS_STYLE: Record<ModuleStatus, { dot: string; label: string }> = {
  configured: { dot: 'text-emerald-400', label: 'text-emerald-300/90' },
  partial: { dot: 'text-amber-400', label: 'text-amber-200/85' },
  platform: { dot: 'text-stone-500', label: 'text-stone-400' },
  gap: { dot: 'text-red-400/90', label: 'text-red-300/85' },
};

const GRID_SLOTS: ReadonlyArray<{ moduleId: string; className: string }> = [
  { moduleId: 'tools', className: 'col-start-1 row-start-1' },
  { moduleId: 'loop', className: 'col-start-2 row-start-1' },
  { moduleId: 'hooks', className: 'col-start-3 row-start-1' },
  { moduleId: 'context', className: 'col-start-1 row-start-2' },
  { moduleId: 'state', className: 'col-start-3 row-start-2' },
  { moduleId: 'subagent', className: 'col-start-1 row-start-3' },
  { moduleId: 'stop', className: 'col-start-2 row-start-3' },
  { moduleId: 'evaluator', className: 'col-start-3 row-start-3' },
];

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

interface AgentArchitecturePanelProps {
  form: AgentArchFormSlice;
  agents: AnyAdapterConfig[];
}

export function AgentArchitecturePanel({ form, agents }: AgentArchitecturePanelProps) {
  const [open, setOpen] = useState(false);
  const modules = useMemo(() => deriveModules(form, agents), [form, agents]);
  const byId = useMemo(() => Object.fromEntries(modules.map((m) => [m.id, m])), [modules]);

  const gaps = modules.filter((m) => m.status === 'gap').length;
  const partials = modules.filter((m) => m.status === 'partial').length;

  return (
    <div className="border border-amber-300/20 bg-amber-950/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-amber-950/35"
        aria-expanded={open}
      >
        <ChevronDown
          size={12}
          className={`shrink-0 text-amber-300/70 transition-transform ${open ? 'rotate-180' : ''}`}
        />
        <span className="text-[11px] uppercase tracking-[0.14em] text-amber-100/90">
          Agent Architecture
        </span>
        <span className="text-[10px] text-stone-500">八模組 · 你的 Agent 知不知道遇到問題？</span>
        <span className="ml-auto flex items-center gap-2 text-[10px]">
          {gaps > 0 && <span className="text-red-300/85">{gaps} gap</span>}
          {partials > 0 && <span className="text-amber-200/75">{partials} partial</span>}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-amber-300/15 px-3 pb-3 pt-2">
          <p className="text-[10px] leading-relaxed text-stone-400">
            A role is more than a system prompt — it is the{' '}
            <span className="text-stone-300">job description</span> for an autonomous loop. Configure
            the highlighted spokes below; platform spokes are owned by Project Manager runtime.
          </p>

          <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
            {GRID_SLOTS.map(({ moduleId, className }) => {
              const mod = byId[moduleId];
              if (!mod) return null;
              const style = STATUS_STYLE[mod.status];
              const emphasize = mod.id === 'context' || mod.id === 'tools';
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => scrollToSection(mod.sectionId)}
                  className={[
                    className,
                    'flex min-h-[52px] flex-col items-center justify-center border px-1 py-1 text-center transition-colors',
                    emphasize
                      ? 'border-amber-300/35 bg-amber-950/45 hover:border-amber-200/50'
                      : 'border-stone-200/12 bg-[rgb(var(--pm-card-3))]/55 hover:border-stone-200/25',
                  ].join(' ')}
                  title={`${mod.fieldLabel} — ${mod.statusNote}`}
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-stone-200">
                    {mod.en}
                  </span>
                  <span className="text-[8px] text-stone-500">{mod.zh}</span>
                  <Circle size={5} className={`mt-0.5 fill-current ${style.dot}`} />
                </button>
              );
            })}
            <div
              className="col-start-2 row-start-2 flex flex-col items-center justify-center border border-amber-300/30 bg-amber-950/60"
              aria-hidden
            >
              <span className="h-4 w-0.5 bg-amber-300/70" />
              <span className="text-[8px] uppercase tracking-[0.12em] text-amber-200/80">hub</span>
            </div>
          </div>

          <ul className="space-y-1.5">
            {modules.map((mod) => {
              const style = STATUS_STYLE[mod.status];
              return (
                <li key={mod.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(mod.sectionId)}
                    className="flex w-full items-start gap-2 rounded-sm px-1 py-0.5 text-left hover:bg-stone-200/5"
                  >
                    <Circle size={6} className={`mt-1 shrink-0 fill-current ${style.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-[10px] text-stone-300">
                        {mod.en}
                        <span className="text-stone-600"> · </span>
                        {mod.fieldLabel}
                      </span>
                      <span className={`block text-[10px] leading-snug ${style.label}`}>
                        {mod.statusNote}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
