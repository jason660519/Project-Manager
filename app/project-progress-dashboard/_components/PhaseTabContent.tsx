'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ActiveRun, EngineerRole, Feature, FeaturePhase, FeaturePromptConfig } from '../../../lib/types';
import { useI18n } from '../../../lib/i18n';
import type { CustomProjectProgressRow, PhaseTablePrefs } from '../types';
import { buildFeatureDependencyGraph, getFeatureDependencyIdentity } from '../_lib/dependencies';
import { buildPhaseRows, type PhaseRow } from '../_lib/phaseRows';
import { columnsForPhase } from '../_lib/columns';
import {
  E2E_TEST_CATEGORY_IDS,
  e2eCategorySearchTokens,
  formatE2eCategoryShort,
  sortE2eCategoryIds,
} from '../_lib/e2eCategories';
import { PhaseTable } from './PhaseTable';
import { PhaseTableToolbar } from './PhaseTableToolbar';
import { AddRowModal } from './AddRowModal';
import { FeatureDocPanel } from './FeatureDocPanel';

interface PhaseTabContentProps {
  phase: FeaturePhase;
  projectName: string;
  projectNames?: string[];
  projectRoot: string;
  features: Feature[];
  dependencyFeatures?: Feature[];
  engineerRoles?: EngineerRole[];
  prefs: PhaseTablePrefs;
  patch: (next: Partial<PhaseTablePrefs>) => void;
  reset: () => void;
  onFeaturePromptSave: (featureId: string, config: FeaturePromptConfig) => void;
  /** Generic feature patcher — receives the namespaced feature id (`<projectId>::<featureId>`). */
  onFeaturePatch: (namespacedFeatureId: string, patch: Partial<Feature>) => void;
  /** Active agent runs, threaded to column handlers for running-state chips. */
  activeRuns?: ActiveRun[];
  /** Quick dispatch — opens a modal owned by the parent. Undefined disables the button. */
  onDispatchRow?: (row: PhaseRow) => void;
}

export function PhaseTabContent({
  phase, projectName, projectNames, projectRoot, features, dependencyFeatures, engineerRoles, prefs, patch, reset,
  onFeaturePromptSave, onFeaturePatch, activeRuns, onDispatchRow,
}: PhaseTabContentProps) {
  const { t } = useI18n();
  const columns = useMemo(() => columnsForPhase(phase, t.dashboard.projectName), [phase, t]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showHiddenRows, setShowHiddenRows] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [notesPanelPath, setNotesPanelPath] = useState<string | null>(null);
  const dependencyGraph = useMemo(
    () => buildFeatureDependencyGraph(dependencyFeatures ?? features),
    [dependencyFeatures, features],
  );

  // All rows for this phase (features + custom rows).
  const allRows = useMemo(
    () => buildPhaseRows(features, phase, prefs.customRows, { defaultProjectName: projectName }),
    [features, phase, prefs.customRows, projectName],
  );

  const categoryList = useMemo(() => {
    const set = new Set<string>();
    if (phase === 'e2e_testing') {
      E2E_TEST_CATEGORY_IDS.forEach((id) => set.add(id));
    }
    allRows.forEach((r) => set.add(r.category));
    return phase === 'e2e_testing' ? sortE2eCategoryIds(Array.from(set)) : Array.from(set).sort();
  }, [allRows, phase]);

  const hiddenSet = useMemo(() => new Set(prefs.hiddenRowKeys), [prefs.hiddenRowKeys]);
  const hiddenRowItems = useMemo(
    () => allRows
      .filter((row) => hiddenSet.has(row.rowKey))
      .map((row) => ({ key: row.rowKey, label: `${row.id} · ${row.name}` })),
    [allRows, hiddenSet],
  );

  // Apply search + category + hidden filter.
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRows.filter((r) => {
      if (selectedCategories.size > 0 && !selectedCategories.has(r.category)) return false;
      if (!showHiddenRows && hiddenSet.has(r.rowKey)) return false;
      if (q) {
        const catHay = phase === 'e2e_testing' ? e2eCategorySearchTokens(r.category) : r.category;
        const upstream = (r.upstreamDependencies ?? []).map((dep) => `${dep.projectId ?? ''} ${dep.featureId}`).join(' ');
        const downstream = r.feature
          ? (dependencyGraph.downstreamByKey.get(getFeatureDependencyIdentity(r.feature).key) ?? [])
            .map((dep) => `${dep.ref.projectId ?? ''} ${dep.ref.featureId}`)
            .join(' ')
          : '';
        const hay = `${r.projectName ?? ''} ${r.id} ${r.name} ${catHay} ${r.locatedSection ?? ''} ${upstream} ${downstream}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, selectedCategories, hiddenSet, showHiddenRows, searchQuery, phase]);

  const visibleRows = useMemo(() => {
    const activeSort = prefs.sorting[0];
    if (!activeSort) return filteredRows;
    const column = columns.find((item) => item.id === activeSort.columnId);
    if (!column?.accessor) return filteredRows;
    const direction = activeSort.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const av = column.accessor?.(a);
      const bv = column.accessor?.(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * direction;
    });
  }, [columns, filteredRows, prefs.sorting]);

  const onToggleHideRow = useCallback((rowKey: string) => {
    const current = prefs.hiddenRowKeys;
    const next = current.includes(rowKey) ? current.filter((k) => k !== rowKey) : [...current, rowKey];
    patch({ hiddenRowKeys: next });
  }, [prefs.hiddenRowKeys, patch]);

  const onRestoreHiddenRow = useCallback((rowKey: string) => {
    patch({ hiddenRowKeys: prefs.hiddenRowKeys.filter((key) => key !== rowKey) });
  }, [patch, prefs.hiddenRowKeys]);

  const onRestoreAllHiddenRows = useCallback(() => {
    patch({ hiddenRowKeys: [] });
  }, [patch]);

  const onAdd = useCallback((row: CustomProjectProgressRow) => {
    patch({ customRows: [...prefs.customRows, row] });
  }, [prefs.customRows, patch]);

  const onDeleteCustomRow = useCallback((rowId: string) => {
    patch({ customRows: prefs.customRows.filter((r) => r.rowId !== rowId) });
  }, [prefs.customRows, patch]);

  const existingIds = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => set.add(r.id));
    return set;
  }, [allRows]);

  // Route a per-feature patch using the dashboard's namespaced id, since
  // MainClient needs `<projectId>::<featureId>` to look up the right project.
  const onPatchFeature = useCallback(
    (featureId: string, p: Partial<Feature>) => onFeaturePatch(featureId, p),
    [onFeaturePatch],
  );

  // Route a per-custom-row patch back into the phase prefs store.
  const onPatchCustomRow = useCallback(
    (rowId: string, p: Partial<CustomProjectProgressRow>) => {
      patch({
        customRows: prefs.customRows.map((r) =>
          r.rowId === rowId ? { ...r, ...p } : r,
        ),
      });
    },
    [prefs.customRows, patch],
  );

  // Phase move: features go through MainClient (cross-project safe); custom
  // rows stay in the local phase prefs but jump to a different phase's bucket.
  const onChangePhase = useCallback(
    (row: PhaseRow, nextPhase: FeaturePhase) => {
      if (nextPhase === phase) return;
      if (row.source === 'feature' && row.feature) {
        onFeaturePatch(row.feature.id, { phase: nextPhase });
      } else if (row.source === 'custom' && row.customRowId) {
        // Drop from current phase prefs; the destination phase's localStorage
        // bucket will be picked up by its own usePhasePreferences hook on next
        // render. The custom row payload carries its target phase inside it.
        patch({
          customRows: prefs.customRows.filter((r) => r.rowId !== row.customRowId),
        });
        const moved = prefs.customRows.find((r) => r.rowId === row.customRowId);
        if (moved && typeof window !== 'undefined') {
          // Append to the destination phase's storage directly to avoid an
          // extra hook subscription; the destination tab will read this on
          // mount or refresh.
          const key = `projectManager.progressDashboard.phase.${nextPhase}`;
          try {
            const raw = window.localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : {};
            const existing: CustomProjectProgressRow[] = Array.isArray(parsed.customRows) ? parsed.customRows : [];
            const merged: CustomProjectProgressRow[] = [...existing, { ...moved, phase: nextPhase }];
            window.localStorage.setItem(key, JSON.stringify({ ...parsed, customRows: merged }));
          } catch {
            /* quota / disabled — drop silently */
          }
        }
      }
    },
    [phase, onFeaturePatch, prefs.customRows, patch],
  );

  const handlers = useMemo(() => ({
    projectRoot,
    engineerRoles,
    activeRuns,
    dependencyGraph,
    hiddenRowKeysSet: hiddenSet,
    onToggleHideRow,
    onDeleteCustomRow,
    onPatchFeature,
    onPatchCustomRow,
    onChangePhase,
    onDispatch: onDispatchRow,
    onOpenNotePanel: (absPath: string) => setNotesPanelPath(absPath),
  }), [projectRoot, engineerRoles, activeRuns, dependencyGraph, hiddenSet, onToggleHideRow, onDeleteCustomRow, onPatchFeature, onPatchCustomRow, onChangePhase, onDispatchRow]);

  return (
    <div className="flex flex-col gap-2">
      <PhaseTableToolbar
        prefs={prefs}
        patch={patch}
        reset={reset}
        columns={columns}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showHiddenRows={showHiddenRows}
        onShowHiddenRowsChange={setShowHiddenRows}
        hiddenRowsCount={hiddenSet.size}
        hiddenRowItems={hiddenRowItems}
        onRestoreHiddenRow={onRestoreHiddenRow}
        onRestoreAllHiddenRows={onRestoreAllHiddenRows}
        onAddRow={() => setAddRowOpen(true)}
      />

      <PhaseTable
        rows={visibleRows}
        columns={columns}
        prefs={prefs}
        patch={patch}
        handlers={handlers}
        categoryFilter={{
          categories: categoryList,
          selected: selectedCategories,
          onChange: setSelectedCategories,
          formatLabel: phase === 'e2e_testing' ? formatE2eCategoryShort : undefined,
        }}
      />

      <AddRowModal
        open={addRowOpen}
        onClose={() => setAddRowOpen(false)}
        phase={phase}
        defaultProjectName={projectName}
        projectNames={projectNames}
        existingIds={existingIds}
        onAdd={onAdd}
      />
      <FeatureDocPanel
        absPath={notesPanelPath}
        onClose={() => setNotesPanelPath(null)}
      />
    </div>
  );
}
