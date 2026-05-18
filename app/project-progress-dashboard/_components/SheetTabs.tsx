'use client';

import { Code2, FlaskConical, Rocket, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import type { FeaturePhase } from '../../../lib/types';

interface SheetTab {
  id: FeaturePhase;
  label: string;
  zhLabel: string;
  icon: React.ElementType;
  color: string;
  activeColor: string;
}

const SHEETS: SheetTab[] = [
  { id: 'development', label: 'Development', zhLabel: '開發',
    icon: Code2,         color: 'text-emerald-300',
    activeColor: 'bg-emerald-600/85 text-white' },
  { id: 'e2e_testing', label: 'E2E Testing', zhLabel: 'E2E 測試',
    icon: FlaskConical,  color: 'text-cyan-200',
    activeColor: 'bg-cyan-600/85 text-white' },
  { id: 'deployment',  label: 'Deployment',  zhLabel: '部署',
    icon: Rocket,        color: 'text-fuchsia-200',
    activeColor: 'bg-fuchsia-600/80 text-white' },
  { id: 'operations',  label: 'Operations',  zhLabel: '運維',
    icon: Activity,      color: 'text-amber-200',
    activeColor: 'bg-amber-600/85 text-white' },
];

interface SheetTabsProps {
  activePhase: FeaturePhase;
  onPhaseChange: (phase: FeaturePhase) => void;
  phaseCounts: Record<FeaturePhase, number>;
}

export function SheetTabs({ activePhase, onPhaseChange, phaseCounts }: SheetTabsProps) {
  return (
    <div className="flex items-end gap-0 border-t border-stone-200/15 bg-[#061512]/70 overflow-x-auto flex-none">
      {SHEETS.map((sheet) => {
        const isActive = activePhase === sheet.id;
        const Icon = sheet.icon;
        const count = phaseCounts[sheet.id];
        return (
          <button
            key={sheet.id}
            type="button"
            onClick={() => {
              onPhaseChange(sheet.id);
              if (typeof window !== 'undefined') window.location.hash = sheet.id;
            }}
            className={clsx(
              'relative flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors border-r border-stone-200/15 last:border-r-0 whitespace-nowrap',
              isActive
                ? sheet.activeColor + ' shadow-sm'
                : 'text-stone-300/85 hover:text-stone-100 hover:bg-white/5',
            )}
          >
            <Icon className={clsx('h-4 w-4', isActive ? 'text-current' : sheet.color)} />
            <span>{sheet.zhLabel} {sheet.label}</span>
            {count > 0 && (
              <span
                className={clsx(
                  'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                  isActive ? 'bg-white/25 text-white' : 'bg-stone-200/15 text-stone-100',
                )}
              >
                {count}
              </span>
            )}
            {isActive && (
              <span className="absolute top-0 left-0 right-0 h-0.5 bg-white/60" />
            )}
          </button>
        );
      })}
      <div className="flex-1 min-w-[20px]" />
    </div>
  );
}
