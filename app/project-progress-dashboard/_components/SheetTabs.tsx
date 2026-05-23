'use client';

import { Activity, Code2, FlaskConical, FolderKanban, Github, Rocket } from 'lucide-react';
import { clsx } from 'clsx';
import type { FeaturePhase } from '../../../lib/types';
import type { TabId } from '../types';
import { useI18n } from '../../../lib/i18n';

interface SheetTab {
  id: TabId;
  icon: React.ElementType;
  color: string;
  activeColor: string;
  isPhase: boolean;
}

const SHEETS: SheetTab[] = [
  { id: 'projects',    icon: FolderKanban,  color: 'text-amber-100',    activeColor: 'bg-amber-600/85 text-white', isPhase: false },
  { id: 'issues',      icon: Github,        color: 'text-sky-200',      activeColor: 'bg-sky-600/85 text-white', isPhase: false },
  { id: 'development', icon: Code2,         color: 'text-emerald-300',  activeColor: 'bg-emerald-600/85 text-white', isPhase: true },
  { id: 'e2e_testing', icon: FlaskConical,  color: 'text-cyan-200',     activeColor: 'bg-cyan-600/85 text-white', isPhase: true },
  { id: 'deployment',  icon: Rocket,        color: 'text-fuchsia-200',  activeColor: 'bg-fuchsia-600/80 text-white', isPhase: true },
  { id: 'operations',  icon: Activity,      color: 'text-amber-200',    activeColor: 'bg-amber-600/85 text-white', isPhase: true },
];

const PHASE_LABEL_KEY: Record<FeaturePhase, keyof import('../../../lib/i18n').Translations['phases']> = {
  development: 'development',
  e2e_testing: 'e2eTesting',
  deployment:  'deployment',
  operations:  'operations',
};

interface SheetTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  phaseCounts?: Record<FeaturePhase, number>;
  projectCount?: number;
}

export function SheetTabs({ activeTab, onTabChange, phaseCounts, projectCount = 0 }: SheetTabsProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-end gap-0 border-t border-stone-200/15 bg-[rgb(var(--pm-rail))]/70 overflow-x-auto flex-none">
      {SHEETS.map((sheet) => {
        const isActive = activeTab === sheet.id;
        const Icon = sheet.icon;
        const count = sheet.isPhase
          ? (phaseCounts?.[sheet.id as FeaturePhase] ?? 0)
          : sheet.id === 'projects'
            ? projectCount
            : 0;
        const label = sheet.isPhase
          ? t.phases[PHASE_LABEL_KEY[sheet.id as FeaturePhase]]
          : sheet.id === 'projects'
            ? t.navItems.projects
            : t.phases.issues;
        return (
          <button
            key={sheet.id}
            type="button"
            onClick={() => {
              onTabChange(sheet.id);
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
            <span>{label}</span>
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
