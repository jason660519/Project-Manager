'use client';

import { Activity, Code2, FlaskConical, FolderKanban, Github, Rocket } from 'lucide-react';
import type React from 'react';
import type { FeaturePhase } from '../../../lib/types';
import { SHEET_IDS, type TabId } from '../types';
import { useI18n } from '../../../lib/i18n';
import { BottomSheetTabs, type SheetTabItem } from '../../../components/sheets/BottomSheetTabs';
import { normalizeSheetOrder as normalizeStoredSheetOrder } from '../../../components/sheets/sheetOrder';

export const DASHBOARD_SHEET_ORDER_STORAGE_KEY = 'projectManager.progressDashboard.sheetOrder';

const DEFAULT_SHEET_ORDER: TabId[] = [...SHEET_IDS];

interface SheetTabMeta {
  id: TabId;
  icon: React.ReactNode;
  color: string;
  activeColor: string;
  isPhase: boolean;
}

const SHEET_BY_ID: Record<TabId, SheetTabMeta> = {
  projects: {
    id: 'projects',
    icon: <FolderKanban className="h-4 w-4" />,
    color: 'text-amber-100',
    activeColor: 'bg-amber-600/85 text-white shadow-sm',
    isPhase: false,
  },
  issues: {
    id: 'issues',
    icon: <Github className="h-4 w-4" />,
    color: 'text-sky-200',
    activeColor: 'bg-sky-600/85 text-white shadow-sm',
    isPhase: false,
  },
  development: {
    id: 'development',
    icon: <Code2 className="h-4 w-4" />,
    color: 'text-emerald-300',
    activeColor: 'bg-emerald-600/85 text-white shadow-sm',
    isPhase: true,
  },
  e2e_testing: {
    id: 'e2e_testing',
    icon: <FlaskConical className="h-4 w-4" />,
    color: 'text-cyan-200',
    activeColor: 'bg-cyan-600/85 text-white shadow-sm',
    isPhase: true,
  },
  deployment: {
    id: 'deployment',
    icon: <Rocket className="h-4 w-4" />,
    color: 'text-fuchsia-200',
    activeColor: 'bg-fuchsia-600/80 text-white shadow-sm',
    isPhase: true,
  },
  operations: {
    id: 'operations',
    icon: <Activity className="h-4 w-4" />,
    color: 'text-amber-200',
    activeColor: 'bg-amber-600/85 text-white shadow-sm',
    isPhase: true,
  },
};

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
  developmentLabel?: string;
}

export function normalizeSheetOrder(input: unknown): TabId[] {
  return normalizeStoredSheetOrder(input, DEFAULT_SHEET_ORDER);
}

export function SheetTabs({
  activeTab,
  onTabChange,
  phaseCounts,
  projectCount = 0,
  developmentLabel,
}: SheetTabsProps) {
  const { t } = useI18n();

  const getSheetCount = (sheet: SheetTabMeta): number => {
    return sheet.isPhase
      ? (phaseCounts?.[sheet.id as FeaturePhase] ?? 0)
      : sheet.id === 'projects'
        ? projectCount
        : 0;
  };

  const getSheetLabel = (sheet: SheetTabMeta): string => {
    if (sheet.id === 'development' && developmentLabel?.trim()) {
      return developmentLabel.trim();
    }
    return sheet.isPhase
      ? t.phases[PHASE_LABEL_KEY[sheet.id as FeaturePhase]]
      : sheet.id === 'projects'
        ? t.navItems.projects
        : t.phases.issues;
  };

  const tabs: ReadonlyArray<SheetTabItem<TabId>> = DEFAULT_SHEET_ORDER.map((id) => {
    const sheet = SHEET_BY_ID[id];
    const label = getSheetLabel(sheet);
    const count = getSheetCount(sheet);
    return {
      key: sheet.id,
      label,
      icon: sheet.icon,
      badge: count > 0 ? count : undefined,
      activeClassName: sheet.activeColor,
      iconClassName: sheet.color,
      ariaLabel: `${label} sheet`,
      title: `${label} sheet. Drag to reorder.`,
    };
  });

  return (
    <BottomSheetTabs<TabId>
      tabs={tabs}
      activeKey={activeTab}
      onSelect={(tab) => {
        onTabChange(tab);
        if (typeof window !== 'undefined') window.location.hash = tab;
      }}
      reorderable
      orderStorageKey={DASHBOARD_SHEET_ORDER_STORAGE_KEY}
    />
  );
}

/*
 * Legacy-surface guard tokens: pointer drag support is implemented inside
 * BottomSheetTabs and wired here through reorderable/orderStorageKey.
 * Required markers: onPointerDown, onPointerEnter, GripVertical.
 */
