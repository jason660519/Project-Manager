'use client';

import { useCallback, useMemo, useState } from 'react';
import type { AgentAdapterConfig, EngineerRole, Feature, FeaturePhase, FeaturePromptConfig } from '../../../lib/types';
import { useI18n } from '../../../lib/i18n';
import type { CustomProjectProgressRow, PhaseTablePrefs } from '../types';
import { buildPhaseRows, type PhaseRow } from '../_lib/phaseRows';
import { columnsForPhase } from '../_lib/columns';
import { summarizeStatuses } from '../_lib/aggregations';
import {
  E2E_TEST_CATEGORY_IDS,
  e2eCategorySearchTokens,
  formatE2eCategoryShort,
  sortE2eCategoryIds,
} from '../_lib/e2eCategories';
import { PhaseTable } from './PhaseTable';
import { PhaseTableToolbar } from './PhaseTableToolbar';
import { AddRowModal } from './AddRowModal';
import { PromptEngineerModal } from './PromptEngineerModal';
import { FeatureDocPanel } from './FeatureDocPanel';

interface PhaseTabContentProps {
  phase: FeaturePhase;
  projectName: string;
  projectNames?: string[];
  projectRoot: string;
  features: Feature[];
  engineerRoles: EngineerRole[];
  prefs: PhaseTablePrefs;
  patch: (next: Partial<PhaseTablePrefs>) => void;
  reset: () => void;
  agents: AgentAdapterConfig[];
  onFeaturePromptSave: (featureId: string, config: FeaturePromptConfig) => void;
  /** Generic feature patcher — receives the namespaced feature id (`<projectId>::<featureId>`). */
  onFeaturePatch: (namespacedFeatureId: string, patch: Partial<Feature>) => void;
  /** Quick dispatch — opens a modal owned by the parent. Undefined disables the button. */
  onDispatchRow?: (row: PhaseRow) => void;
}

export function PhaseTabContent({
  phase, projectName, projectNames, projectRoot, features, engineerRoles, prefs, patch, reset, agents,
  onFeaturePromptSave, onFeaturePatch, onDispatchRow,
}: PhaseTabContentProps) {
  const { t } = useI18n();
  const columns = useMemo(() => columnsForPhase(phase, t.dashboard.projectName), [phase, t]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showHiddenRows, setShowHiddenRows] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [promptRow, setPromptRow] = useState<PhaseRow | null>(null);
  const [notesPanelPath, setNotesPanelPath] = useState<string | null>(null);

  // All rows for this phase (features + custom rows).
  const allRows = useMemo(
    () => buildPhaseRows(features, phase, prefs.customRows, { defaultProjectName: projectName }),
    [features, phase, prefs.customRows, projectName],
  );

  // Status summary for the top-of-tab strip (development tab uses it).
  const summary = useMemo(() => summarizeStatuses(
    allRows.map((r) => r.feature ?? syntheticFeature(r)),
  ), [allRows]);

  const categoryList = useMemo(() => {
    const set = new Set<string>();
    if (phase === 'e2e_testing') {
      E2E_TEST_CATEGORY_IDS.forEach((id) => set.add(id));
    }
    allRows.forEach((r) => set.add(r.category));
    return phase === 'e2e_testing' ? sortE2eCategoryIds(Array.from(set)) : Array.from(set).sort();
  }, [allRows, phase]);

  const hiddenSet = useMemo(() => new Set(prefs.hiddenRowKeys), [prefs.hiddenRowKeys]);

  // Apply search + category + hidden filter.
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRows.filter((r) => {
      if (selectedCategories.size > 0 && !selectedCategories.has(r.category)) return false;
      if (!showHiddenRows && hiddenSet.has(r.rowKey)) return false;
      if (q) {
        const catHay = phase === 'e2e_testing' ? e2eCategorySearchTokens(r.category) : r.category;
        const hay = `${r.projectName ?? ''} ${r.id} ${r.name} ${catHay} ${r.locatedPage ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, selectedCategories, hiddenSet, showHiddenRows, searchQuery, phase]);

  const onToggleHideRow = useCallback((rowKey: string) => {
    const current = prefs.hiddenRowKeys;
    const next = current.includes(rowKey) ? current.filter((k) => k !== rowKey) : [...current, rowKey];
    patch({ hiddenRowKeys: next });
  }, [prefs.hiddenRowKeys, patch]);

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

  const onPromptSave = useCallback((row: PhaseRow, config: FeaturePromptConfig) => {
    if (row.source === 'feature' && row.feature) {
      onFeaturePromptSave(row.feature.id, config);
    }
  }, [onFeaturePromptSave]);

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
    hiddenRowKeysSet: hiddenSet,
    onToggleHideRow,
    onDeleteCustomRow,
    onOpenPromptConfig: (row: PhaseRow) => setPromptRow(row),
    onPatchFeature,
    onPatchCustomRow,
    onChangePhase,
    onDispatch: onDispatchRow,
    onOpenNotePanel: (absPath: string) => setNotesPanelPath(absPath),
  }), [projectRoot, engineerRoles, hiddenSet, onToggleHideRow, onDeleteCustomRow, onPatchFeature, onPatchCustomRow, onChangePhase, onDispatchRow]);

  return (
    <div className="flex flex-col gap-2">
      {phase === 'development' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard label="Completed"    value={summary.completed} />
          <SummaryCard label="In Progress"  value={summary.in_progress} />
          <SummaryCard label="Not Started"  value={summary.not_started} />
          <SummaryCard label="On Hold"      value={summary.on_hold} />
        </div>
      )}

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
        onAddRow={() => setAddRowOpen(true)}
      />

      <PhaseTable
        rows={filteredRows}
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
      <PromptEngineerModal
        open={promptRow != null}
        onClose={() => setPromptRow(null)}
        row={promptRow}
        agents={agents}
        onSave={onPromptSave}
      />
      <FeatureDocPanel
        absPath={notesPanelPath}
        onClose={() => setNotesPanelPath(null)}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-stone-200/15 bg-[#0a2622]/70 px-2 py-1">
      <p className="text-[10px] uppercase tracking-[0.1em] text-stone-400">{label}</p>
      <p className="text-sm font-semibold text-stone-100">{value}</p>
    </div>
  );
}

/** Minimal Feature shim built from a custom PhaseRow so aggregations work. */
function syntheticFeature(row: PhaseRow): Feature {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    progress: row.progress,
    points: row.points,
    paths: {},
    testCoverage: row.testCoverage,
    testStatus: row.testStatus,
    deployStatus: row.deployStatus,
    deployEnv: row.deployEnv,
    deployDate: row.deployDate,
    uptimePercent: row.uptimePercent,
    errorRate: row.errorRate,
    avgResponseTime: row.avgResponseTime,
    lastIncident: row.lastIncident,
  };
}
