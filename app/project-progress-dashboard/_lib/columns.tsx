'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Eye, EyeOff, FileText, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type {
  ActiveRun, DeployStatus, EngineerRole, Feature, FeaturePhase, FeatureStatus,
  HarnessRoleStatus, HarnessTaskRole, TestStatus,
} from '../../../lib/types';
import type { CustomProjectProgressRow } from '../types';
import type { PhaseRow } from './phaseRows';
import { COL_ID_COLUMN_HEADER } from '../../../components/table/colId';
import { PathLink, resolveProjectPath } from './pathLinks';
import { E2E_CATEGORY_PALETTE, e2eCategorySelectOptions } from './e2eCategories';

export interface ColumnDef {
  id: string;
  header: string;
  cell: (row: PhaseRow, handlers: ColumnHandlers) => React.ReactNode;
  accessor?: (row: PhaseRow) => string | number;
}

export interface ColumnHandlers {
  projectRoot: string;
  engineerRoles?: EngineerRole[];
  activeRuns?: ActiveRun[];
  hiddenRowKeysSet: Set<string>;
  onToggleHideRow: (rowKey: string) => void;
  onDeleteCustomRow: (rowId: string) => void;
  onPatchFeature: (featureId: string, patch: Partial<Feature>) => void;
  onPatchCustomRow: (rowId: string, patch: Partial<CustomProjectProgressRow>) => void;
  onChangePhase: (row: PhaseRow, phase: FeaturePhase) => void;
  /** Quick dispatch — only meaningful for feature rows. Undefined disables it. */
  onDispatch?: (row: PhaseRow) => void;
  /** Opens the FeatureDocPanel for the given absolute file path. */
  onOpenNotePanel?: (absPath: string) => void;
}

const STATUS_STYLE: Record<FeatureStatus, string> = {
  todo:        'border-stone-300/25 bg-stone-200/10 text-stone-200',
  in_progress: 'border-cyan-200/25  bg-cyan-100/12  text-cyan-100',
  done:        'border-emerald-200/25 bg-emerald-100/12 text-emerald-100',
  on_hold:     'border-red-400/30   bg-red-500/18    text-red-200',
};

// ── Patching helper: routes Patch<Feature> on a feature row, Patch<CustomRow>
//    on a custom row.  Centralises the source check so cells don't repeat it.
function patchRow(row: PhaseRow, patch: Partial<Feature> & Partial<CustomProjectProgressRow>, h: ColumnHandlers) {
  if (row.source === 'feature' && row.featureId) {
    // Strip CustomRow-only keys (rowId, percentage, phase) so the feature
    // record never grows orphan fields if a caller passes a shared shape.
    const { rowId: _r, percentage: _p, phase: _ph, ...featurePatch } = patch as Record<string, unknown>;
    void _r; void _p; void _ph;
    h.onPatchFeature(row.featureId, featurePatch as Partial<Feature>);
  } else if (row.source === 'custom' && row.customRowId) {
    h.onPatchCustomRow(row.customRowId, patch);
  }
}

// ── Editable cell primitives ────────────────────────────────────────────────

function EditableText({
  value, onCommit, placeholder, kind = 'text',
}: {
  value?: string | number;
  onCommit: (next: string) => void;
  placeholder?: string;
  kind?: 'text' | 'date' | 'number';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset draft when the upstream value changes while not editing.
  useEffect(() => {
    if (!editing) setDraft(value == null ? '' : String(value));
  }, [value, editing]);

  // Auto-focus when we enter edit mode (clicking the display label).
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    const display = value == null || value === '' ? '—' : String(value);
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className={clsx(
          'inline-flex min-w-[3rem] cursor-text rounded border border-transparent px-1 py-0.5 text-xs hover:border-stone-200/20',
          value == null || value === '' ? 'text-stone-500' : 'text-stone-200',
        )}
      >{display}</button>
    );
  }
  return (
    <input
      ref={inputRef}
      type={kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== String(value ?? '')) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false); }
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      className="h-6 w-20 rounded border border-emerald-300/40 bg-[rgb(var(--pm-code))]/95 px-1 text-xs text-stone-100 focus:outline-none"
    />
  );
}

function EditableSelect<T extends string>({
  value, options, onCommit, palette,
}: {
  value: T | undefined;
  options: Array<{ value: T; label: string }>;
  onCommit: (next: T) => void;
  palette?: Record<T, string>;
}) {
  const handleChange = (v: string) => onCommit(v as T);
  const display = options.find((o) => o.value === value)?.label ?? '—';
  const colour = value && palette?.[value];
  return (
    <select
      value={value ?? ''}
      onChange={(e) => { e.stopPropagation(); handleChange(e.target.value); }}
      onClick={(e) => e.stopPropagation()}
      className={clsx(
        'h-6 cursor-pointer rounded border bg-[rgb(var(--pm-rail))]/90 px-1.5 text-[11px] focus:outline-none focus:border-emerald-300/50',
        colour ?? 'border-stone-200/20 text-stone-200',
      )}
      title={display}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/** Path cell: opens the linked file/folder when set; placeholder when empty. */
function PathCell({
  projectRoot,
  value,
  label,
  onOpenPanel,
}: {
  projectRoot: string;
  value?: string;
  label?: string;
  onOpenPanel?: (absPath: string) => void;
}) {
  return <PathLink projectRoot={projectRoot} relPath={value} label={label} onOpenPanel={onOpenPanel} />;
}

function devLogPath(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/\.md$/i.test(trimmed)) return trimmed;
  return `${trimmed.replace(/\/?$/, '/')}dev-log.md`;
}

// ── Display helpers ─────────────────────────────────────────────────────────

function progressBar(percent: number) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2">
      {progressBarTrack(clamped)}
      <span className="w-10 text-right font-mono text-xs text-stone-300">{clamped}%</span>
    </div>
  );
}

function progressBarTrack(clamped: number) {
  return (
    <div className="h-2 w-20 rounded bg-stone-200/15">
      <div
        className={clsx(
          'h-2 rounded transition-all',
          clamped >= 100 ? 'bg-emerald-400' : clamped > 0 ? 'bg-cyan-400' : 'bg-stone-500',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Bar + percent label; click the label to edit (no duplicate bare integer). */
function EditableProgressBar({
  percent,
  onCommit,
  allowEmpty = false,
}: {
  percent?: number;
  onCommit: (next: number | undefined) => void;
  allowEmpty?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(percent == null ? '' : String(percent));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(percent == null ? '' : String(percent));
  }, [percent, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  const showTrack = percent != null;

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        {showTrack && progressBarTrack(clamped)}
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={100}
          value={draft}
          placeholder={allowEmpty ? '0-100' : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const raw = draft.trim();
            if (raw === '') {
              if (allowEmpty && percent != null) onCommit(undefined);
              return;
            }
            const n = Math.max(0, Math.min(100, Number(raw) || 0));
            if (n !== (percent ?? 0)) onCommit(n);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setDraft(percent == null ? '' : String(percent));
              setEditing(false);
            }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-6 w-14 rounded border border-emerald-300/40 bg-[rgb(var(--pm-code))]/95 px-1 text-right font-mono text-xs text-stone-100 focus:outline-none"
        />
      </div>
    );
  }

  const label = percent == null ? '—' : `${clamped}%`;
  return (
    <div className="flex items-center gap-2">
      {showTrack && progressBarTrack(clamped)}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className={clsx(
          'w-10 cursor-text rounded border border-transparent py-0.5 text-right font-mono text-xs hover:border-stone-200/20',
          percent == null ? 'text-stone-500' : 'text-stone-300',
        )}
      >{label}</button>
    </div>
  );
}

// ── Shared columns ──────────────────────────────────────────────────────────

function categoryColumn(phase: FeaturePhase): ColumnDef {
  if (phase === 'e2e_testing') {
    return {
      id: 'col-category',
      header: 'E2E Category',
      accessor: (r) => r.category,
      cell: (r, h) => (
        <EditableSelect<string>
          value={r.category}
          options={e2eCategorySelectOptions(r.category)}
          palette={E2E_CATEGORY_PALETTE as Record<string, string>}
          onCommit={(v) => { if (v) patchRow(r, { category: v }, h); }}
        />
      ),
    };
  }
  return {
    id: 'col-category',
    header: 'Category',
    accessor: (r) => r.category,
    cell: (r) => (
      <span className="rounded-sm border border-amber-200/20 bg-amber-100/10 px-2 py-0.5 text-[11px] text-amber-100/90">
        {r.category}
      </span>
    ),
  };
}

function pointsColumn(): ColumnDef {
  return {
    id: 'col-points',
    header: 'SP',
    accessor: (r) => r.points,
    cell: (r, h) => (
      <EditableText
        value={r.points}
        kind="number"
        onCommit={(v) => patchRow(r, { points: Math.max(0, Number(v) || 0) }, h)}
      />
    ),
  };
}

function commonIdNameCols(phase: FeaturePhase, projectNameLabel = 'Project Name'): ColumnDef[] {
  const cols: ColumnDef[] = [
    {
      id: 'col-id',
      header: COL_ID_COLUMN_HEADER,
      accessor: (r) => r.uuid,
      cell: (r) => (
        <span
          className="block max-w-[160px] truncate font-mono text-[11px] text-stone-300"
          title={`${r.uuid} · ${r.rowKey}`}
        >
          {r.uuid}
        </span>
      ),
    },
    {
      id: 'col-project',
      header: projectNameLabel,
      accessor: (r) => r.projectName ?? '',
      cell: (r) => (
        <span className="block max-w-full truncate text-[11px] text-cyan-100/90" title={r.projectName}>
          {r.projectName ?? '—'}
        </span>
      ),
    },
    { id: 'col-feature-id', header: 'Feature ID', accessor: (r) => r.id, cell: (r) => (
      <span className="font-mono text-[11px] text-stone-300">{r.id}</span>
    )},
  ];
  if (phase === 'development') cols.push(pointsColumn());
  cols.push(
    categoryColumn(phase),
    { id: 'col-name', header: 'Function / Feature', accessor: (r) => r.name, cell: (r) => (
      <span className="text-sm font-medium text-stone-100">{r.name}</span>
    )},
  );
  return cols;
}

function resolveRoleStatus(
  role: HarnessTaskRole,
  feature: Feature | undefined,
  activeRuns: ActiveRun[] | undefined,
): HarnessRoleStatus {
  const assignment = feature?.harnessAssignments?.[role];
  if (!assignment) return 'idle';
  if (assignment.activePid != null && activeRuns?.some((r) => r.pid === assignment.activePid)) {
    return 'running';
  }
  return assignment.status ?? 'idle';
}

const PWE_IDLE_STYLE: Record<HarnessTaskRole, string> = {
  planner: 'border-stone-200/15 bg-stone-500/10 text-stone-200',
  worker: 'border-stone-200/15 bg-cyan-500/10 text-cyan-100',
  evaluator: 'border-stone-200/15 bg-amber-500/10 text-amber-100',
};

const PWE_LETTER_STYLE: Record<HarnessTaskRole, string> = {
  planner: 'text-stone-400',
  worker: 'text-cyan-200/80',
  evaluator: 'text-amber-200/80',
};

const PWE_SHORT: Record<HarnessTaskRole, string> = { planner: 'P', worker: 'W', evaluator: 'E' };

function PWEChip({
  role, name, status,
}: {
  role: HarnessTaskRole;
  name: string;
  status: HarnessRoleStatus;
}) {
  if (status === 'running') {
    return (
      <span
        className="inline-flex h-6 items-center gap-1 rounded border border-emerald-300/30 bg-emerald-500/15 px-1.5 text-[10px] leading-none text-emerald-100"
        title={`${role}: ${name} (running)`}
      >
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        <span className="max-w-[90px] truncate">{name}</span>
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span
        className="inline-flex h-6 items-center gap-1 rounded border border-emerald-200/20 bg-emerald-500/10 px-1.5 text-[10px] leading-none text-emerald-200"
        title={`${role}: ${name} (done)`}
      >
        <span className="text-[10px] text-emerald-300">✓</span>
        <span className="max-w-[90px] truncate">{name}</span>
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        className="inline-flex h-6 items-center gap-1 rounded border border-red-400/25 bg-red-500/12 px-1.5 text-[10px] leading-none text-red-200"
        title={`${role}: ${name} (error)`}
      >
        <span className="text-[10px] text-red-300">✗</span>
        <span className="max-w-[90px] truncate">{name}</span>
      </span>
    );
  }
  return (
    <span
      className={clsx('inline-flex h-6 items-center gap-1 rounded border px-1.5 text-[10px] leading-none', PWE_IDLE_STYLE[role])}
      title={`${role}: ${name}`}
    >
      <span className={clsx('font-mono text-[10px]', PWE_LETTER_STYLE[role])}>{PWE_SHORT[role]}</span>
      <span className="max-w-[90px] truncate">{name}</span>
    </span>
  );
}

function actionsCol(): ColumnDef {
  return {
    id: 'col-actions',
    header: 'Dispatch',
    cell: (row, h) => {
      const hidden = h.hiddenRowKeysSet.has(row.rowKey);
      const canDispatch = h.onDispatch && row.source === 'feature';
      const resolveEngineerName = (engineerRoleId: string | undefined) => {
        if (!engineerRoleId) return '—';
        const role = h.engineerRoles?.find((r) => r.id === engineerRoleId);
        return role?.name ?? engineerRoleId;
      };
      const plannerRoleId = row.feature?.harnessAssignments?.planner?.engineerRoleId;
      const workerRoleId =
        row.feature?.harnessAssignments?.worker?.engineerRoleId
        ?? row.assignedRoleId
        ?? row.feature?.assignedRoleId;
      const evaluatorRoleId = row.feature?.harnessAssignments?.evaluator?.engineerRoleId;
      return (
        <div className="flex items-center gap-1">
          {row.source === 'feature' && (
            <div className="mr-1 flex items-center gap-1">
              <PWEChip
                role="planner"
                name={resolveEngineerName(plannerRoleId)}
                status={resolveRoleStatus('planner', row.feature, h.activeRuns)}
              />
              <PWEChip
                role="worker"
                name={resolveEngineerName(workerRoleId)}
                status={resolveRoleStatus('worker', row.feature, h.activeRuns)}
              />
              <PWEChip
                role="evaluator"
                name={resolveEngineerName(evaluatorRoleId)}
                status={resolveRoleStatus('evaluator', row.feature, h.activeRuns)}
              />
            </div>
          )}
          {row.source === 'custom' && (
            <PhaseSwitch row={row} onChange={(p) => h.onChangePhase(row, p)} />
          )}
          {canDispatch && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); h.onDispatch?.(row); }}
              className="flex h-6 items-center gap-1 rounded border border-emerald-200/30 bg-emerald-500/15 px-1.5 text-[11px] text-emerald-100 hover:bg-emerald-500/25"
              title="Dispatch — assign engineer, IDE, phase, and run"
            >
              <Bot size={11} /> Dispatch
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); h.onToggleHideRow(row.rowKey); }}
            className="flex h-6 w-6 items-center justify-center rounded border border-stone-200/15 text-stone-300 hover:bg-white/10 hover:text-stone-100"
            title={hidden ? 'Unhide row' : 'Hide row'}
          >
            {hidden ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          {row.source === 'custom' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (row.customRowId) h.onDeleteCustomRow(row.customRowId); }}
              className="flex h-6 w-6 items-center justify-center rounded border border-red-400/30 text-red-300 hover:bg-red-500/15 hover:text-red-200"
              title="Delete custom row"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      );
    },
  };
}

function PhaseSwitch({ row, onChange }: { row: PhaseRow; onChange: (p: FeaturePhase) => void }) {
  // Persist the *table's* current phase for the row by reading from the row's
  // own data — features carry it as feature.phase, custom rows as custom.phase.
  const current: FeaturePhase = row.feature?.phase ?? row.custom?.phase ?? 'development';
  return (
    <select
      value={current}
      onChange={(e) => { e.stopPropagation(); onChange(e.target.value as FeaturePhase); }}
      onClick={(e) => e.stopPropagation()}
      className="h-6 rounded border border-stone-200/20 bg-[rgb(var(--pm-rail))]/90 px-1.5 text-[10px] uppercase tracking-[0.08em] text-stone-200 hover:border-emerald-300/40"
      title="Move feature to another phase"
    >
      <option value="development">DEV</option>
      <option value="e2e_testing">E2E</option>
      <option value="deployment">DEPLOY</option>
      <option value="operations">OPS</option>
    </select>
  );
}

// ── Editable cells (one per phase-specific field) ───────────────────────────

const TEST_STATUS_OPTIONS = [
  { value: 'passed',  label: 'Passed' },
  { value: 'failed',  label: 'Failed' },
  { value: 'pending', label: 'Pending' },
] as const;
const TEST_STATUS_PALETTE: Record<TestStatus, string> = {
  passed:  'border-emerald-300/40 text-emerald-200',
  failed:  'border-red-400/40 text-red-200',
  pending: 'border-stone-300/30 text-stone-200',
};

const DEPLOY_STATUS_OPTIONS = [
  { value: 'production',  label: 'Production' },
  { value: 'staging',     label: 'Staging' },
  { value: 'not_deployed', label: 'Not Deployed' },
] as const;
const DEPLOY_STATUS_PALETTE: Record<DeployStatus, string> = {
  production:   'border-emerald-300/40 text-emerald-200',
  staging:      'border-amber-300/40 text-amber-200',
  not_deployed: 'border-stone-300/30 text-stone-200',
};

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
  { value: 'on_hold',     label: 'On Hold' },
] as const;

// ── Notes cell — shows a view-button that opens FeatureDocPanel ─────────────

function NotesCell({
  projectRoot,
  readmePath,
  onOpenPanel,
}: {
  projectRoot: string;
  readmePath?: string;
  onOpenPanel: (absPath: string) => void;
}) {
  const candidate = readmePath?.trim();
  if (!candidate) {
    return <span className="text-xs text-stone-500">—</span>;
  }

  const absPath = resolveProjectPath(projectRoot, candidate);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpenPanel(absPath); }}
      title={absPath}
      className="inline-flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] text-cyan-200/90 hover:bg-white/5 hover:text-cyan-100 transition-colors"
    >
      <FileText size={11} className="shrink-0 opacity-80" />
      <span className="truncate max-w-[120px]">README.md</span>
    </button>
  );
}

function AcceptanceChecklistCell({ row, handlers }: { row: PhaseRow; handlers: ColumnHandlers }) {
  const items = row.feature?.acceptanceChecklist ?? [];
  const total = items.length;
  const passed = items.filter((i) => i.passes).length;
  const [open, setOpen] = useState(false);

  const status = total === 0 ? 'empty' : passed === total ? 'done' : passed > 0 ? 'partial' : 'todo';
  const badgeClass = status === 'done'
    ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-200'
    : status === 'partial'
      ? 'border-amber-300/35 bg-amber-500/10 text-amber-200'
      : status === 'todo'
        ? 'border-stone-300/25 bg-stone-500/10 text-stone-200'
        : 'border-stone-200/15 bg-stone-500/5 text-stone-500';

  const toggle = (id: string) => {
    const next = items.map((it) => (it.id === id ? { ...it, passes: !it.passes } : it));
    patchRow(row, { acceptanceChecklist: next }, handlers);
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`inline-flex h-6 items-center gap-1 rounded border px-1.5 text-[11px] ${badgeClass}`}
        title={total === 0 ? 'No checklist' : `Checklist: ${passed}/${total} passed`}
      >
        <span className="font-mono text-[10px] opacity-80">CL</span>
        <span className="font-mono text-[11px]">{total === 0 ? '—' : `${passed}/${total}`}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg border border-stone-200/15 bg-[rgb(var(--pm-panel))] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200/12 bg-white/[0.035] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-100">Acceptance Checklist</p>
                <p className="mt-0.5 text-[11px] text-stone-400">
                  {row.id} · {row.name} · {total === 0 ? '—' : `${passed}/${total} passed`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border border-stone-200/25 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-white/5"
              >
                Close
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto px-4 py-3">
              {total === 0 ? (
                <p className="text-sm text-stone-400">No checklist yet. Add acceptanceChecklist items in config.json for this feature.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-start justify-between gap-3 border border-stone-200/10 bg-white/[0.02] px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">{it.id}</p>
                        <p className="mt-0.5 text-sm text-stone-200">{it.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(it.id)}
                        className={[
                          'shrink-0 rounded border px-2 py-1 text-[11px] font-semibold',
                          it.passes
                            ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                            : 'border-stone-300/25 bg-stone-500/10 text-stone-200 hover:bg-white/5',
                        ].join(' ')}
                      >
                        {it.passes ? 'PASS' : 'TODO'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Column factories ────────────────────────────────────────────────────────

export function createDevelopmentColumns(projectNameLabel?: string): ColumnDef[] {
  return [
    ...commonIdNameCols('development', projectNameLabel),
    { id: 'col-progress', header: 'Progress', accessor: (r) => r.progress, cell: (r, h) => (
      <EditableProgressBar
        percent={r.progress}
        onCommit={(n) => patchRow(r, { progress: n ?? 0, percentage: n ?? 0 }, h)}
      />
    )},
    { id: 'col-status', header: 'Status', accessor: (r) => r.status, cell: (r, h) => (
      <div className="flex flex-col gap-0.5">
        <EditableSelect
          value={r.status as FeatureStatus}
          options={STATUS_OPTIONS as unknown as Array<{ value: FeatureStatus; label: string }>}
          palette={STATUS_STYLE}
          onCommit={(v) => patchRow(r, { status: v }, h)}
        />
        {r.assignedTo && r.status === 'in_progress' && (
          <span
            className="inline-block max-w-[120px] truncate rounded-sm border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] leading-tight text-amber-200/90"
            title={r.assignedAt
              ? `${r.assignedTo} · ${new Date(r.assignedAt).toLocaleString()}`
              : r.assignedTo}
          >
            {r.assignedTo}
          </span>
        )}
        {r.lastDispatchModel && (
          <span
            className="inline-block max-w-[140px] truncate rounded-sm border border-stone-400/20 bg-stone-500/10 px-1.5 py-0.5 text-[10px] leading-tight text-stone-400"
            title={`Last dispatch: ${r.lastDispatchModel}`}
          >
            {r.lastDispatchModel}
          </span>
        )}
      </div>
    )},
    { id: 'col-checklist', header: 'Checklist', accessor: (r) => (
      r.feature?.acceptanceChecklist?.filter((i) => i.passes).length ?? 0
    ), cell: (r, h) => (r.source === 'feature' ? <AcceptanceChecklistCell row={r} handlers={h} /> : <span className="text-xs text-stone-500">—</span>) },
    { id: 'col-section', header: 'Located Section', accessor: (r) => r.locatedSection ?? '', cell: (r, h) => (
      <EditableText
        value={r.locatedSection}
        onCommit={(v) => patchRow(r, { locatedSection: v || undefined }, h)}
      />
    )},
    {
      id: 'col-spec',
      header: 'Feature Spec',
      accessor: (r) => r.specPath ?? '',
      cell: (r, h) => (
        <PathCell
          projectRoot={r.sourceProjectRoot ?? h.projectRoot}
          value={r.specPath}
          label="feature-spec.md"
          onOpenPanel={h.onOpenNotePanel}
        />
      ),
    },
    {
      id: 'col-tdd',
      header: 'TDD Spec',
      accessor: (r) => r.tddPath ?? '',
      cell: (r, h) => (
        <PathCell
          projectRoot={r.sourceProjectRoot ?? h.projectRoot}
          value={r.tddPath}
          label="tdd-spec.md"
          onOpenPanel={h.onOpenNotePanel}
        />
      ),
    },
    {
      id: 'col-unit-integ',
      header: 'Unit/Integ Test',
      accessor: (r) => r.unitIntegrationTestPath ?? '',
      cell: (r, h) => (
        <PathCell
          projectRoot={r.sourceProjectRoot ?? h.projectRoot}
          value={r.unitIntegrationTestPath}
          label="unit-integration-test"
          onOpenPanel={h.onOpenNotePanel}
        />
      ),
    },
    {
      id: 'col-e2e-folder',
      header: 'E2E Folder',
      accessor: (r) => r.e2eAcceptanceTestScriptFolder ?? '',
      cell: (r, h) => (
        <PathCell
          projectRoot={r.sourceProjectRoot ?? h.projectRoot}
          value={r.e2eAcceptanceTestScriptFolder}
          label="e2e-folder"
          onOpenPanel={h.onOpenNotePanel}
        />
      ),
    },
    { id: 'col-tdd-progress', header: 'TDD Progress', accessor: (r) => r.tddProgress ?? -1, cell: (r, h) => (
      <EditableProgressBar
        percent={r.tddProgress}
        allowEmpty
        onCommit={(n) => patchRow(r, { tddProgress: n }, h)}
      />
    )},
    {
      id: 'col-tdd-report',
      header: 'TDD Report',
      accessor: (r) => r.tddReportPath ?? '',
      cell: (r, h) => (
        <PathCell
          projectRoot={r.sourceProjectRoot ?? h.projectRoot}
          value={r.tddReportPath}
          label="tdd-report.md"
          onOpenPanel={h.onOpenNotePanel}
        />
      ),
    },
    {
      id: 'col-debug-retro',
      header: 'Debug Retro',
      accessor: (r) => r.debugRetroPath ?? '',
      cell: (r, h) => (
        <PathCell
          projectRoot={r.sourceProjectRoot ?? h.projectRoot}
          value={r.debugRetroPath}
          label="debug-retro.md"
          onOpenPanel={h.onOpenNotePanel}
        />
      ),
    },
    {
      id: 'col-test-scenarios',
      header: 'Test Scenarios',
      accessor: (r) => r.testScenariosPath ?? '',
      cell: (r, h) => (
        <PathCell
          projectRoot={r.sourceProjectRoot ?? h.projectRoot}
          value={r.testScenariosPath}
          label="test-scenarios.md"
          onOpenPanel={h.onOpenNotePanel}
        />
      ),
    },
    {
      id: 'col-dev-log',
      header: 'Dev Logs',
      accessor: (r) => r.devLogFolder ?? '',
      cell: (r, h) => (
        <PathCell
          projectRoot={r.sourceProjectRoot ?? h.projectRoot}
          value={devLogPath(r.devLogFolder)}
          label="dev-log.md"
          onOpenPanel={h.onOpenNotePanel}
        />
      ),
    },
    { id: 'col-notes', header: 'README', accessor: (r) => r.notes ?? '', cell: (r, h) => (
      <NotesCell
        projectRoot={r.sourceProjectRoot ?? h.projectRoot}
        readmePath={r.readmePath}
        onOpenPanel={(absPath) => h.onOpenNotePanel?.(absPath)}
      />
    )},
    actionsCol(),
  ];
}

export function createTestingColumns(projectNameLabel?: string): ColumnDef[] {
  return [
    ...commonIdNameCols('e2e_testing', projectNameLabel),
    { id: 'col-coverage', header: 'Coverage', accessor: (r) => r.testCoverage ?? -1, cell: (r, h) => (
      <EditableProgressBar
        percent={r.testCoverage}
        allowEmpty
        onCommit={(n) => patchRow(r, { testCoverage: n }, h)}
      />
    )},
    { id: 'col-test-status', header: 'Test Status', accessor: (r) => r.testStatus ?? '', cell: (r, h) => (
      <EditableSelect
        value={r.testStatus}
        options={TEST_STATUS_OPTIONS as unknown as Array<{ value: TestStatus; label: string }>}
        palette={TEST_STATUS_PALETTE}
        onCommit={(v) => patchRow(r, { testStatus: v as TestStatus }, h)}
      />
    )},
    { id: 'col-progress', header: 'Progress', accessor: (r) => r.progress, cell: (r) => progressBar(r.progress) },
    { id: 'col-section', header: 'Located Section', accessor: (r) => r.locatedSection ?? '', cell: (r, h) => (
      <EditableText
        value={r.locatedSection}
        onCommit={(v) => patchRow(r, { locatedSection: v || undefined }, h)}
      />
    )},
    actionsCol(),
  ];
}

export function createDeploymentColumns(projectNameLabel?: string): ColumnDef[] {
  return [
    ...commonIdNameCols('deployment', projectNameLabel),
    { id: 'col-deploy-status', header: 'Status', accessor: (r) => r.deployStatus ?? '', cell: (r, h) => (
      <EditableSelect
        value={r.deployStatus}
        options={DEPLOY_STATUS_OPTIONS as unknown as Array<{ value: DeployStatus; label: string }>}
        palette={DEPLOY_STATUS_PALETTE}
        onCommit={(v) => patchRow(r, { deployStatus: v as DeployStatus }, h)}
      />
    )},
    { id: 'col-env', header: 'Environment', accessor: (r) => r.deployEnv ?? '', cell: (r, h) => (
      <EditableText
        value={r.deployEnv}
        onCommit={(v) => patchRow(r, { deployEnv: v || undefined }, h)}
      />
    )},
    { id: 'col-date', header: 'Deploy Date', accessor: (r) => r.deployDate ?? '', cell: (r, h) => (
      <EditableText
        value={r.deployDate}
        kind="date"
        onCommit={(v) => patchRow(r, { deployDate: v || undefined }, h)}
      />
    )},
    { id: 'col-progress', header: 'Progress', accessor: (r) => r.progress, cell: (r) => progressBar(r.progress) },
    actionsCol(),
  ];
}

// Numeric ops field with optional unit-suffix display.  Keep parsing simple:
// the EditableText commit handler always receives raw numeric text (the
// number-typed input strips the suffix in the editing path), and the display
// value omits the suffix so users see "99.5" not "99.5%%" when re-editing.
function opsNumericCell(
  key: 'uptimePercent' | 'errorRate' | 'avgResponseTime',
): (r: PhaseRow, h: ColumnHandlers) => React.ReactNode {
  return (r, h) => (
    <EditableText
      value={(r as unknown as Record<string, number | undefined>)[key]}
      kind="number"
      onCommit={(v) => {
        const n = Number(v);
        patchRow(r, { [key]: v !== '' && Number.isFinite(n) ? n : undefined } as Partial<Feature>, h);
      }}
    />
  );
}

export function createOperationsColumns(projectNameLabel?: string): ColumnDef[] {
  return [
    ...commonIdNameCols('operations', projectNameLabel),
    { id: 'col-uptime',   header: 'Uptime %',      accessor: (r) => r.uptimePercent   ?? -1, cell: opsNumericCell('uptimePercent') },
    { id: 'col-error',    header: 'Error %',       accessor: (r) => r.errorRate       ?? -1, cell: opsNumericCell('errorRate') },
    { id: 'col-rt',       header: 'Response (ms)', accessor: (r) => r.avgResponseTime ?? -1, cell: opsNumericCell('avgResponseTime') },
    { id: 'col-incident', header: 'Last Incident', accessor: (r) => r.lastIncident    ?? '', cell: (r, h) => (
      <EditableText
        value={r.lastIncident}
        onCommit={(v) => patchRow(r, { lastIncident: v || undefined }, h)}
      />
    )},
    actionsCol(),
  ];
}

export function columnsForPhase(phase: FeaturePhase, projectNameLabel?: string): ColumnDef[] {
  switch (phase) {
    case 'e2e_testing': return createTestingColumns(projectNameLabel);
    case 'deployment': return createDeploymentColumns(projectNameLabel);
    case 'operations': return createOperationsColumns(projectNameLabel);
    default: return createDevelopmentColumns(projectNameLabel);
  }
}
