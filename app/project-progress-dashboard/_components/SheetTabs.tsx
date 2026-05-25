'use client';

import { Activity, Code2, FlaskConical, FolderKanban, Github, GripVertical, Rocket } from 'lucide-react';
import { clsx } from 'clsx';
import type { FeaturePhase } from '../../../lib/types';
import { SHEET_IDS, type TabId } from '../types';
import { useI18n } from '../../../lib/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';

export const DASHBOARD_SHEET_ORDER_STORAGE_KEY = 'projectManager.progressDashboard.sheetOrder';

interface SheetTab {
  id: TabId;
  icon: React.ElementType;
  color: string;
  activeColor: string;
  isPhase: boolean;
}

const DEFAULT_SHEET_ORDER: TabId[] = [...SHEET_IDS];

const SHEET_BY_ID: Record<TabId, SheetTab> = {
  projects:    { id: 'projects',    icon: FolderKanban,  color: 'text-amber-100',    activeColor: 'bg-amber-600/85 text-white', isPhase: false },
  issues:      { id: 'issues',      icon: Github,        color: 'text-sky-200',      activeColor: 'bg-sky-600/85 text-white', isPhase: false },
  development: { id: 'development', icon: Code2,         color: 'text-emerald-300',  activeColor: 'bg-emerald-600/85 text-white', isPhase: true },
  e2e_testing: { id: 'e2e_testing', icon: FlaskConical,  color: 'text-cyan-200',     activeColor: 'bg-cyan-600/85 text-white', isPhase: true },
  deployment:  { id: 'deployment',  icon: Rocket,        color: 'text-fuchsia-200',  activeColor: 'bg-fuchsia-600/80 text-white', isPhase: true },
  operations:  { id: 'operations',  icon: Activity,      color: 'text-amber-200',    activeColor: 'bg-amber-600/85 text-white', isPhase: true },
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
}

export function normalizeSheetOrder(input: unknown): TabId[] {
  if (!Array.isArray(input)) return DEFAULT_SHEET_ORDER;

  const knownIds = new Set<string>(DEFAULT_SHEET_ORDER);
  const seen = new Set<TabId>();
  const ordered: TabId[] = [];

  for (const item of input) {
    if (typeof item !== 'string' || !knownIds.has(item) || seen.has(item as TabId)) continue;
    const tabId = item as TabId;
    seen.add(tabId);
    ordered.push(tabId);
  }

  return [...ordered, ...DEFAULT_SHEET_ORDER.filter((id) => !seen.has(id))];
}

function readStoredSheetOrder(): TabId[] {
  if (typeof window === 'undefined') return DEFAULT_SHEET_ORDER;
  try {
    return normalizeSheetOrder(JSON.parse(window.localStorage.getItem(DASHBOARD_SHEET_ORDER_STORAGE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_SHEET_ORDER;
  }
}

function persistSheetOrder(order: TabId[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DASHBOARD_SHEET_ORDER_STORAGE_KEY, JSON.stringify(order));
}

function moveTab(order: TabId[], from: TabId, to: TabId): TabId[] {
  if (from === to) return order;
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return order;
  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, from);
  return next;
}

export function SheetTabs({ activeTab, onTabChange, phaseCounts, projectCount = 0 }: SheetTabsProps) {
  const { t } = useI18n();
  const [sheetOrder, setSheetOrder] = useState<TabId[]>(DEFAULT_SHEET_ORDER);
  const [draggingTab, setDraggingTab] = useState<TabId | null>(null);
  const [dropTargetTab, setDropTargetTab] = useState<TabId | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const draggingTabRef = useRef<TabId | null>(null);
  const suppressClickRef = useRef(false);
  const sheets = useMemo(() => normalizeSheetOrder(sheetOrder).map((id) => SHEET_BY_ID[id]), [sheetOrder]);

  const commitSheetOrder = (next: TabId[]) => {
    const normalized = normalizeSheetOrder(next);
    setSheetOrder(normalized);
    persistSheetOrder(normalized);
  };

  useEffect(() => {
    setSheetOrder(readStoredSheetOrder());
  }, []);

  useEffect(() => {
    if (!draggingTab) return;

    const moveDrag = (event: PointerEvent) => {
      setDragPoint({ x: event.clientX, y: event.clientY });
    };

    const endDrag = () => {
      draggingTabRef.current = null;
      setDraggingTab(null);
      setDropTargetTab(null);
      setDragPoint(null);
    };

    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', moveDrag);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [draggingTab]);

  const getSheetCount = (sheet: SheetTab): number => {
    return sheet.isPhase
      ? (phaseCounts?.[sheet.id as FeaturePhase] ?? 0)
      : sheet.id === 'projects'
        ? projectCount
        : 0;
  };

  const getSheetLabel = (sheet: SheetTab): string => {
    return sheet.isPhase
      ? t.phases[PHASE_LABEL_KEY[sheet.id as FeaturePhase]]
      : sheet.id === 'projects'
        ? t.navItems.projects
        : t.phases.issues;
  };

  const draggingSheet = draggingTab ? SHEET_BY_ID[draggingTab] : null;
  const DraggingIcon = draggingSheet?.icon;
  const draggingLabel = draggingSheet ? getSheetLabel(draggingSheet) : '';
  const draggingCount = draggingSheet ? getSheetCount(draggingSheet) : 0;

  return (
    <>
      <div className="flex items-end gap-0 border-t border-stone-200/15 bg-[rgb(var(--pm-rail))]/70 overflow-x-auto flex-none">
        {sheets.map((sheet) => {
          const isActive = activeTab === sheet.id;
          const isDragging = draggingTab === sheet.id;
          const isDropTarget = dropTargetTab === sheet.id && draggingTab !== sheet.id;
          const Icon = sheet.icon;
          const count = getSheetCount(sheet);
          const label = getSheetLabel(sheet);
          return (
            <button
              key={sheet.id}
              type="button"
              aria-label={`${label} sheet`}
              aria-grabbed={isDragging}
              title={`${label} sheet. Drag to reorder.`}
              onClick={(event) => {
                if (suppressClickRef.current) {
                  event.preventDefault();
                  suppressClickRef.current = false;
                  return;
                }
                onTabChange(sheet.id);
                if (typeof window !== 'undefined') window.location.hash = sheet.id;
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                draggingTabRef.current = sheet.id;
                setDraggingTab(sheet.id);
                setDragPoint({ x: event.clientX, y: event.clientY });
              }}
              onPointerEnter={() => {
                const draggedTab = draggingTabRef.current;
                if (!draggedTab || draggedTab === sheet.id) return;
                suppressClickRef.current = true;
                setDropTargetTab(sheet.id);
                commitSheetOrder(moveTab(sheetOrder, draggedTab, sheet.id));
              }}
              className={clsx(
                'relative flex transform-gpu cursor-grab select-none items-center gap-2 border-r border-stone-200/15 px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,color,opacity,transform] duration-150 ease-out last:border-r-0 active:cursor-grabbing motion-reduce:transform-none motion-reduce:transition-none',
                isActive
                  ? sheet.activeColor + ' shadow-sm'
                  : 'text-stone-300/85 hover:text-stone-100 hover:bg-white/5',
                isDragging && 'opacity-40',
                isDropTarget && '-translate-y-0.5 ring-1 ring-inset ring-white/70',
              )}
            >
              <GripVertical className="h-3.5 w-3.5 text-stone-400/80" aria-hidden="true" />
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

      {draggingSheet && DraggingIcon && dragPoint && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[9999] flex transform-gpu items-center gap-2 whitespace-nowrap border border-stone-200/25 bg-[rgb(var(--pm-rail))]/95 px-5 py-2.5 text-sm font-medium text-stone-100 opacity-95 shadow-2xl ring-1 ring-white/20 motion-reduce:hidden"
          style={{
            transform: `translate3d(${dragPoint.x + 12}px, ${dragPoint.y - 18}px, 0) rotate(-1deg) scale(1.04)`,
          }}
        >
          <GripVertical className="h-3.5 w-3.5 text-stone-300/90" />
          <DraggingIcon className={clsx('h-4 w-4', draggingSheet.color)} />
          <span>{draggingLabel}</span>
          {draggingCount > 0 && (
            <span className="ml-1 rounded-full bg-stone-200/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-stone-100">
              {draggingCount}
            </span>
          )}
        </div>
      )}
    </>
  );
}
