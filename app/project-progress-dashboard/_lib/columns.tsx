'use client';

import { Settings2, Trash2, EyeOff, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import type { FeaturePhase } from '../../../lib/types';
import type { PhaseRow } from './phaseRows';

export interface ColumnDef {
  id: string;
  header: string;
  /** Cell renderer. Receives the row plus a handlers bag. */
  cell: (row: PhaseRow, handlers: ColumnHandlers) => React.ReactNode;
  /** Accessor for search/sort. */
  accessor?: (row: PhaseRow) => string | number;
}

export interface ColumnHandlers {
  hiddenRowKeysSet: Set<string>;
  onToggleHideRow: (rowKey: string) => void;
  onOpenPromptConfig: (row: PhaseRow) => void;
  onDeleteCustomRow: (rowId: string) => void;
}

function progressBar(percent: number) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 bg-stone-200/15 rounded">
        <div
          className={clsx(
            'h-2 rounded transition-all',
            clamped >= 100 ? 'bg-emerald-400' : clamped > 0 ? 'bg-cyan-400' : 'bg-stone-500',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs text-stone-300">{clamped}%</span>
    </div>
  );
}

function statusPill(value: string | undefined, type: 'test' | 'deploy') {
  if (!value) return <span className="text-xs text-stone-500">—</span>;
  const palette: Record<string, string> = {
    passed: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-200',
    failed: 'border-red-400/30 bg-red-500/15 text-red-300',
    pending: 'border-stone-300/30 bg-stone-200/10 text-stone-200',
    production: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-200',
    staging: 'border-amber-300/30 bg-amber-500/15 text-amber-200',
    not_deployed: 'border-stone-300/30 bg-stone-200/10 text-stone-200',
  };
  const cls = palette[value] ?? 'border-stone-300/30 bg-stone-200/10 text-stone-200';
  const label = type === 'deploy' && value === 'not_deployed' ? 'Not Deployed' : value;
  return (
    <span className={clsx('inline-block border px-2 py-0.5 text-[11px] font-medium capitalize rounded-sm', cls)}>
      {label}
    </span>
  );
}

const text = (v?: string | number) => (
  v == null || v === '' ? <span className="text-xs text-stone-500">—</span> : <span className="text-xs text-stone-200">{String(v)}</span>
);

function commonActionsCol(): ColumnDef {
  return {
    id: 'actions',
    header: '',
    cell: (row, h) => {
      const hidden = h.hiddenRowKeysSet.has(row.rowKey);
      return (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              h.onOpenPromptConfig(row);
            }}
            className="flex h-6 w-6 items-center justify-center rounded border border-stone-200/15 text-stone-300 hover:text-stone-100 hover:bg-white/10"
            title="Configure prompt"
          >
            <Settings2 size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              h.onToggleHideRow(row.rowKey);
            }}
            className="flex h-6 w-6 items-center justify-center rounded border border-stone-200/15 text-stone-300 hover:text-stone-100 hover:bg-white/10"
            title={hidden ? 'Unhide row' : 'Hide row'}
          >
            {hidden ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          {row.source === 'custom' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (row.customRowId) h.onDeleteCustomRow(row.customRowId);
              }}
              className="flex h-6 w-6 items-center justify-center rounded border border-red-400/30 text-red-300 hover:text-red-200 hover:bg-red-500/15"
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

function commonIdNameCols(): ColumnDef[] {
  return [
    { id: 'id', header: 'ID', accessor: (r) => r.id, cell: (r) => (
      <span className="font-mono text-[11px] text-stone-300">{r.id}</span>
    )},
    { id: 'category', header: 'Category', accessor: (r) => r.category, cell: (r) => (
      <span className="border border-amber-200/20 bg-amber-100/10 px-2 py-0.5 text-[11px] text-amber-100/90 rounded-sm">
        {r.category}
      </span>
    )},
    { id: 'name', header: 'Function / Feature', accessor: (r) => r.name, cell: (r) => (
      <span className="text-sm font-medium text-stone-100">{r.name}</span>
    )},
  ];
}

export function createDevelopmentColumns(): ColumnDef[] {
  return [
    ...commonIdNameCols(),
    { id: 'progress', header: 'Progress', accessor: (r) => r.progress, cell: (r) => progressBar(r.progress) },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => (
      <span className="text-[11px] text-stone-200 capitalize">{r.status.replace('_', ' ')}</span>
    )},
    { id: 'points', header: 'SP', accessor: (r) => r.points, cell: (r) => (
      <span className="font-mono text-[11px] text-stone-300">{r.points}</span>
    )},
    { id: 'page', header: 'Located Page', accessor: (r) => r.locatedPage ?? '', cell: (r) => text(r.locatedPage) },
    commonActionsCol(),
  ];
}

export function createTestingColumns(): ColumnDef[] {
  return [
    ...commonIdNameCols(),
    { id: 'coverage', header: 'Coverage', accessor: (r) => r.testCoverage ?? -1, cell: (r) => (
      r.testCoverage == null ? text() : progressBar(r.testCoverage)
    )},
    { id: 'testStatus', header: 'Test Status', accessor: (r) => r.testStatus ?? '', cell: (r) => statusPill(r.testStatus, 'test') },
    { id: 'progress', header: 'Progress', accessor: (r) => r.progress, cell: (r) => progressBar(r.progress) },
    { id: 'page', header: 'Located Page', accessor: (r) => r.locatedPage ?? '', cell: (r) => text(r.locatedPage) },
    commonActionsCol(),
  ];
}

export function createDeploymentColumns(): ColumnDef[] {
  return [
    ...commonIdNameCols(),
    { id: 'deployStatus', header: 'Status', accessor: (r) => r.deployStatus ?? '', cell: (r) => statusPill(r.deployStatus, 'deploy') },
    { id: 'env', header: 'Environment', accessor: (r) => r.deployEnv ?? '', cell: (r) => text(r.deployEnv) },
    { id: 'date', header: 'Deploy Date', accessor: (r) => r.deployDate ?? '', cell: (r) => text(r.deployDate) },
    { id: 'progress', header: 'Progress', accessor: (r) => r.progress, cell: (r) => progressBar(r.progress) },
    commonActionsCol(),
  ];
}

export function createOperationsColumns(): ColumnDef[] {
  return [
    ...commonIdNameCols(),
    { id: 'uptime', header: 'Uptime %', accessor: (r) => r.uptimePercent ?? -1, cell: (r) => text(r.uptimePercent != null ? `${r.uptimePercent}%` : undefined) },
    { id: 'error', header: 'Error %', accessor: (r) => r.errorRate ?? -1, cell: (r) => text(r.errorRate != null ? `${r.errorRate}%` : undefined) },
    { id: 'rt', header: 'Response (ms)', accessor: (r) => r.avgResponseTime ?? -1, cell: (r) => text(r.avgResponseTime) },
    { id: 'incident', header: 'Last Incident', accessor: (r) => r.lastIncident ?? '', cell: (r) => text(r.lastIncident) },
    commonActionsCol(),
  ];
}

export function columnsForPhase(phase: FeaturePhase): ColumnDef[] {
  switch (phase) {
    case 'testing': return createTestingColumns();
    case 'deployment': return createDeploymentColumns();
    case 'operations': return createOperationsColumns();
    default: return createDevelopmentColumns();
  }
}
