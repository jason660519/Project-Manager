'use client';

import { useCallback, useMemo, useState } from 'react';
import type { AgentAdapterConfig, Feature, FeaturePhase, FeaturePromptConfig } from '../../../lib/types';
import type { CustomProjectProgressRow, PhaseTablePrefs } from '../types';
import { buildPhaseRows, type PhaseRow } from '../_lib/phaseRows';
import { columnsForPhase } from '../_lib/columns';
import { summarizeStatuses } from '../_lib/aggregations';
import { PhaseTable } from './PhaseTable';
import { PhaseTableToolbar } from './PhaseTableToolbar';
import { AddRowModal } from './AddRowModal';
import { PromptEngineerModal } from './PromptEngineerModal';

interface PhaseTabContentProps {
  phase: FeaturePhase;
  features: Feature[];
  prefs: PhaseTablePrefs;
  patch: (next: Partial<PhaseTablePrefs>) => void;
  reset: () => void;
  agents: AgentAdapterConfig[];
  onFeaturePromptSave: (featureId: string, config: FeaturePromptConfig) => void;
}

export function PhaseTabContent({
  phase, features, prefs, patch, reset, agents, onFeaturePromptSave,
}: PhaseTabContentProps) {
  const columns = useMemo(() => columnsForPhase(phase), [phase]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showHiddenRows, setShowHiddenRows] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [promptRow, setPromptRow] = useState<PhaseRow | null>(null);

  // All rows for this phase (features + custom rows).
  const allRows = useMemo(
    () => buildPhaseRows(features, phase, prefs.customRows),
    [features, phase, prefs.customRows],
  );

  // Status summary for the top-of-tab strip (development tab uses it).
  const summary = useMemo(() => summarizeStatuses(
    allRows.map((r) => r.feature ?? syntheticFeature(r)),
  ), [allRows]);

  const categoryList = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => set.add(r.category));
    return Array.from(set).sort();
  }, [allRows]);

  const hiddenSet = useMemo(() => new Set(prefs.hiddenRowKeys), [prefs.hiddenRowKeys]);

  // Apply search + category + hidden filter.
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRows.filter((r) => {
      if (selectedCategories.size > 0 && !selectedCategories.has(r.category)) return false;
      if (!showHiddenRows && hiddenSet.has(r.rowKey)) return false;
      if (q) {
        const hay = `${r.id} ${r.name} ${r.category} ${r.locatedPage ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, selectedCategories, hiddenSet, showHiddenRows, searchQuery]);

  const onToggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const onClearCategories = useCallback(() => setSelectedCategories(new Set()), []);

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

  const handlers = useMemo(() => ({
    hiddenRowKeysSet: hiddenSet,
    onToggleHideRow,
    onDeleteCustomRow,
    onOpenPromptConfig: (row: PhaseRow) => setPromptRow(row),
  }), [hiddenSet, onToggleHideRow, onDeleteCustomRow]);

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
        categoryList={categoryList}
        selectedCategories={selectedCategories}
        onToggleCategory={onToggleCategory}
        onClearCategories={onClearCategories}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showHiddenRows={showHiddenRows}
        onShowHiddenRowsChange={setShowHiddenRows}
        hiddenRowsCount={hiddenSet.size}
        onAddRow={() => setAddRowOpen(true)}
      />

      <PhaseTable rows={filteredRows} columns={columns} prefs={prefs} patch={patch} handlers={handlers} />

      <AddRowModal
        open={addRowOpen}
        onClose={() => setAddRowOpen(false)}
        phase={phase}
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
