'use client';

import type { ProgressColumn, ProgressRow, ProgressSheetConfig } from '../../../lib/types';
import { COL_ID_COLUMN_HEADER } from '../../../components/table/colId';
import {
  progressRowColumnValue,
  readProgressRowSupabaseUuid,
} from '../../../lib/progress-sheets/progressRowUuidSync';
import type { ColumnDef } from './columns';
import type { PhaseRow } from './phaseRows';

export interface ProgressSheetPhaseRow extends PhaseRow {
  progressSheetRow: ProgressRow;
}

function formatProgressValue(value: unknown, column?: ProgressColumn): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) {
    return value
      .map((item) => column?.options?.find((option) => option.id === item)?.label ?? String(item))
      .join(', ');
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return column?.fieldType === 'percent' ? `${value}%` : String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return column?.options?.find((option) => option.id === value)?.label ?? String(value);
}

function progressColumnValue(row: ProgressRow, column: ProgressColumn): unknown {
  return progressRowColumnValue(row, column.id);
}

function renderReadOnlyValue(value: unknown, column?: ProgressColumn) {
  const display = formatProgressValue(value, column);
  return (
    <span
      className="block max-w-full truncate text-sm text-stone-200"
      title={display === '—' ? undefined : display}
    >
      {display}
    </span>
  );
}

export function progressSheetRowsToPhaseRows(
  sheetConfig: ProgressSheetConfig,
  projectName?: string,
): ProgressSheetPhaseRow[] {
  return sheetConfig.rows.map((row) => ({
    rowKey: `progress-sheet::${sheetConfig.id}::${row.id}`,
    source: 'custom',
    customRowId: row.id,
    projectName,
    uuid: readProgressRowSupabaseUuid(row) ?? row.id,
    id: row.id,
    name: row.title,
    category: sheetConfig.discipline,
    status: 'todo',
    progress: Math.max(0, Math.min(100, row.progress ?? 0)),
    points: 1,
    progressSheetRow: row,
  }));
}

export function columnsForProgressSheet(sheetConfig: ProgressSheetConfig): ColumnDef[] {
  const configuredColumns = [...sheetConfig.columns]
    .filter((column) => column.visible !== false)
    .sort((a, b) => a.order - b.order);

  return [
    {
      id: 'col-id',
      header: COL_ID_COLUMN_HEADER,
      accessor: (row) => row.uuid,
      cell: (row) => (
        <span className="block max-w-[160px] truncate font-mono text-[11px] text-stone-300" title={row.uuid}>
          {row.uuid}
        </span>
      ),
    },
    {
      id: 'col-title',
      header: 'Item',
      accessor: (row) => row.name,
      cell: (row) => (
        <span className="block max-w-full truncate text-sm font-medium text-stone-100" title={row.name}>
          {row.name}
        </span>
      ),
    },
    ...configuredColumns.map((column): ColumnDef => ({
      id: `col-${column.id}`,
      header: column.label,
      accessor: (row) => {
        const progressRow = (row as ProgressSheetPhaseRow).progressSheetRow;
        const value = progressRow ? progressColumnValue(progressRow, column) : undefined;
        return typeof value === 'number' ? value : formatProgressValue(value, column);
      },
      cell: (row) => {
        const progressRow = (row as ProgressSheetPhaseRow).progressSheetRow;
        return renderReadOnlyValue(progressRow ? progressColumnValue(progressRow, column) : undefined, column);
      },
    })),
  ];
}
