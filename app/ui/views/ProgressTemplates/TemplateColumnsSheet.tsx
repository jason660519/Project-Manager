'use client';

// @table-classification: simple
// @table-reason: Settings editor renders a fixed set of property rows for
//   template field definitions; horizontal scroll is contained in pm-scroll.

import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { ProgressColumn, ProgressFieldType } from '../../../../lib/types';
import {
  PROGRESS_FIELD_TYPE_OPTIONS,
  protectedFieldIdsForTemplate,
} from '../../../../lib/progress-sheets/templateFieldPreferences';
import { isProgressUuidField } from '../../../../lib/progress-sheets/supabaseUuidField';
import { useI18n } from '../../../../lib/i18n';

interface TemplateColumnsSheetProps {
  templateId: string;
  templateLabel: string;
  sheetTitle: string;
  columns: ProgressColumn[];
  onUpdateField: (
    fieldId: string,
    patch: Partial<Pick<ProgressColumn, 'label' | 'fieldType' | 'visible' | 'required'>>,
  ) => void;
  onRemoveField: (fieldId: string) => void;
  onMoveField: (fieldId: string, direction: 'up' | 'down') => void;
}

const COLUMN_WIDTH_STORAGE_KEY = 'projectManager.progressTemplatesSetting.columnWidths.v1';
const ROW_HEIGHT_STORAGE_KEY = 'projectManager.progressTemplatesSetting.rowHeights.v1';
const PROPERTY_COLUMN_ID = '__properties';
const MIN_COLUMN_WIDTH = 120;
const MAX_COLUMN_WIDTH = 480;
const MIN_ROW_HEIGHT = 40;
const MAX_ROW_HEIGHT = 160;
const DEFAULT_PROPERTY_COLUMN_WIDTH = 144;
const DEFAULT_FIELD_COLUMN_WIDTH = 200;
const DEFAULT_PROPERTY_ROW_HEIGHT = 56;

const PROPERTY_ROW_IDS = ['order', 'label', 'fieldId', 'type', 'visible', 'required', 'actions'] as const;
type PropertyRowId = typeof PROPERTY_ROW_IDS[number];

type ColumnWidths = Record<string, number>;
type RowHeights = Record<PropertyRowId, number>;

interface StoredColumnWidths {
  version: 1;
  templates: Record<string, ColumnWidths>;
}

interface StoredRowHeights {
  version: 1;
  templates: Record<string, RowHeights>;
}

function clampColumnWidth(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(value)));
}

function clampRowHeight(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, Math.round(value)));
}

function defaultColumnWidths(columns: ProgressColumn[]): ColumnWidths {
  return Object.fromEntries([
    [PROPERTY_COLUMN_ID, DEFAULT_PROPERTY_COLUMN_WIDTH],
    ...columns.map((column) => [column.id, DEFAULT_FIELD_COLUMN_WIDTH] as const),
  ]);
}

function defaultRowHeights(): RowHeights {
  return Object.fromEntries(
    PROPERTY_ROW_IDS.map((rowId) => [rowId, DEFAULT_PROPERTY_ROW_HEIGHT]),
  ) as RowHeights;
}

function normalizeColumnWidths(columns: ProgressColumn[], input: unknown): ColumnWidths {
  const defaults = defaultColumnWidths(columns);
  if (!input || typeof input !== 'object') return defaults;
  const raw = input as Record<string, unknown>;
  const normalized: ColumnWidths = {};
  for (const columnId of Object.keys(defaults)) {
    normalized[columnId] = clampColumnWidth(raw[columnId]) ?? defaults[columnId]!;
  }
  return normalized;
}

function normalizeRowHeights(input: unknown): RowHeights {
  const defaults = defaultRowHeights();
  if (!input || typeof input !== 'object') return defaults;
  const raw = input as Record<string, unknown>;
  return Object.fromEntries(
    PROPERTY_ROW_IDS.map((rowId) => [rowId, clampRowHeight(raw[rowId]) ?? defaults[rowId]]),
  ) as RowHeights;
}

function readStoredColumnWidths(templateId: string, columns: ProgressColumn[]): ColumnWidths {
  if (typeof window === 'undefined') return defaultColumnWidths(columns);
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY);
    if (!raw) return defaultColumnWidths(columns);
    const parsed = JSON.parse(raw) as Partial<StoredColumnWidths>;
    if (parsed.version !== 1 || !parsed.templates || typeof parsed.templates !== 'object') {
      return defaultColumnWidths(columns);
    }
    return normalizeColumnWidths(columns, parsed.templates[templateId]);
  } catch {
    return defaultColumnWidths(columns);
  }
}

function readStoredRowHeights(templateId: string): RowHeights {
  if (typeof window === 'undefined') return defaultRowHeights();
  try {
    const raw = window.localStorage.getItem(ROW_HEIGHT_STORAGE_KEY);
    if (!raw) return defaultRowHeights();
    const parsed = JSON.parse(raw) as Partial<StoredRowHeights>;
    if (parsed.version !== 1 || !parsed.templates || typeof parsed.templates !== 'object') {
      return defaultRowHeights();
    }
    return normalizeRowHeights(parsed.templates[templateId]);
  } catch {
    return defaultRowHeights();
  }
}

function persistColumnWidths(templateId: string, columns: ProgressColumn[], widths: ColumnWidths): void {
  if (typeof window === 'undefined') return;
  let store: StoredColumnWidths = { version: 1, templates: {} };
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredColumnWidths>;
      if (parsed.version === 1 && parsed.templates && typeof parsed.templates === 'object') {
        store = { version: 1, templates: { ...parsed.templates } };
      }
    }
  } catch {
    store = { version: 1, templates: {} };
  }
  store.templates[templateId] = normalizeColumnWidths(columns, widths);
  window.localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(store));
}

function persistRowHeights(templateId: string, heights: RowHeights): void {
  if (typeof window === 'undefined') return;
  let store: StoredRowHeights = { version: 1, templates: {} };
  try {
    const raw = window.localStorage.getItem(ROW_HEIGHT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredRowHeights>;
      if (parsed.version === 1 && parsed.templates && typeof parsed.templates === 'object') {
        store = { version: 1, templates: { ...parsed.templates } };
      }
    }
  } catch {
    store = { version: 1, templates: {} };
  }
  store.templates[templateId] = normalizeRowHeights(heights);
  window.localStorage.setItem(ROW_HEIGHT_STORAGE_KEY, JSON.stringify(store));
}

export function TemplateColumnsSheet({
  templateId,
  templateLabel,
  sheetTitle,
  columns,
  onUpdateField,
  onRemoveField,
  onMoveField,
}: TemplateColumnsSheetProps) {
  const { t } = useI18n();
  const editor = t.dashboard.progressTemplatesSetting.templateEditor;
  const protectedIds = protectedFieldIdsForTemplate(templateId);
  const fieldTypeOptions = PROGRESS_FIELD_TYPE_OPTIONS.filter((option) => option.value !== 'uuid');
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => defaultColumnWidths(columns));
  const [rowHeights, setRowHeights] = useState<RowHeights>(() => defaultRowHeights());

  useEffect(() => {
    setColumnWidths(readStoredColumnWidths(templateId, columns));
  }, [columns, templateId]);

  useEffect(() => {
    setRowHeights(readStoredRowHeights(templateId));
  }, [templateId]);

  const tableWidth = useMemo(
    () => Object.values(normalizeColumnWidths(columns, columnWidths)).reduce((total, width) => total + width, 0),
    [columnWidths, columns],
  );

  const startColumnResize = useCallback((
    columnId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    button.setPointerCapture?.(event.pointerId);

    const startX = event.clientX;
    const startWidths = normalizeColumnWidths(columns, columnWidths);
    const startWidth = startWidths[columnId] ?? DEFAULT_FIELD_COLUMN_WIDTH;
    let nextWidths = startWidths;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = clampColumnWidth(startWidth + deltaX) ?? startWidth;
      nextWidths = {
        ...startWidths,
        [columnId]: nextWidth,
      };
      setColumnWidths(nextWidths);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      button.releasePointerCapture?.(event.pointerId);
      persistColumnWidths(templateId, columns, nextWidths);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
  }, [columnWidths, columns, templateId]);

  const startRowResize = useCallback((
    rowId: PropertyRowId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    button.setPointerCapture?.(event.pointerId);

    const startY = event.clientY;
    const startHeights = normalizeRowHeights(rowHeights);
    const startHeight = startHeights[rowId];
    let nextHeights = startHeights;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const nextHeight = clampRowHeight(startHeight + deltaY) ?? startHeight;
      nextHeights = {
        ...startHeights,
        [rowId]: nextHeight,
      };
      setRowHeights(nextHeights);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      button.releasePointerCapture?.(event.pointerId);
      persistRowHeights(templateId, nextHeights);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
  }, [rowHeights, templateId]);

  const renderRowResizeHandle = (rowId: PropertyRowId, label: string) => (
    <button
      type="button"
      aria-label={`Resize row ${label}`}
      title={`Resize row ${label}`}
      onPointerDown={(event) => startRowResize(rowId, event)}
      className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize border-b border-transparent hover:border-emerald-400 hover:bg-emerald-400/20 focus-visible:border-emerald-400 focus-visible:bg-emerald-400/20 focus-visible:outline-none transition-colors"
    />
  );

  if (columns.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center border border-stone-200/15 bg-[rgb(var(--pm-card))]/30 px-6 py-10 text-center">
        <p className="text-sm text-stone-300">{editor.emptyColumns}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-none border-b border-stone-200/12 bg-white/[0.02] px-4 py-2">
        <p className="text-xs font-medium text-stone-200">{templateLabel}</p>
        <p className="text-[11px] text-stone-500">{sheetTitle}</p>
      </div>
      <div className="pm-scroll min-h-0 flex-1 overflow-auto">
        <table
          className="table-fixed border-separate border-spacing-0 text-left text-sm"
          style={{ minWidth: '100%', width: tableWidth }}
        >
          <thead className="sticky top-0 z-20 bg-[rgb(var(--pm-rail))]/95 text-stone-300">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 overflow-hidden border-b border-r border-stone-200/15 bg-[rgb(var(--pm-rail))] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400"
                style={{ width: columnWidths[PROPERTY_COLUMN_ID] ?? DEFAULT_PROPERTY_COLUMN_WIDTH }}
              >
                <div className="flex min-h-9 items-center pr-3">
                  <span className="truncate">{editor.appliesTo}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Resize ${editor.appliesTo}`}
                  onPointerDown={(event) => startColumnResize(PROPERTY_COLUMN_ID, event)}
                  className="absolute right-0 top-0 h-full w-3 cursor-col-resize border-r border-transparent hover:border-emerald-400 hover:bg-emerald-400/20 focus-visible:border-emerald-400 focus-visible:bg-emerald-400/20 focus-visible:outline-none transition-colors"
                />
              </th>
              {columns.map((column) => {
                const isUuidField = isProgressUuidField(column.id);
                return (
                  <th
                    key={column.id}
                    scope="col"
                    title={column.label}
                    className={clsx(
                      'relative overflow-hidden border-b border-r border-stone-200/15 px-3 py-2 align-top',
                      isUuidField ? 'bg-violet-500/[0.12]' : 'bg-[rgb(var(--pm-rail))]/95',
                    )}
                    style={{ width: columnWidths[column.id] ?? DEFAULT_FIELD_COLUMN_WIDTH }}
                  >
                    <div className="flex min-h-9 items-center pr-3">
                      <span className="truncate text-sm font-semibold text-stone-100">
                        {column.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Resize ${column.label}`}
                      onPointerDown={(event) => startColumnResize(column.id, event)}
                      className="absolute right-0 top-0 h-full w-3 cursor-col-resize border-r border-transparent hover:border-emerald-400 hover:bg-emerald-400/20 focus-visible:border-emerald-400 focus-visible:bg-emerald-400/20 focus-visible:outline-none transition-colors"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="group text-stone-200 hover:bg-white/[0.03]" style={{ height: rowHeights.order }}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-stone-200/12 bg-[rgb(var(--pm-panel))] px-3 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400 group-hover:bg-[rgb(var(--pm-rail))]"
              >
                {editor.columns.order}
                {renderRowResizeHandle('order', editor.columns.order)}
              </th>
              {columns.map((column, index) => {
                const isUuidField = isProgressUuidField(column.id);
                return (
                  <td key={column.id} className="overflow-hidden border-b border-r border-stone-200/10 px-3 py-3 align-top">
                    {isUuidField ? (
                      <span className="inline-flex h-7 items-center px-1 text-[11px] text-stone-500">-</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => onMoveField(column.id, 'up')}
                          className="inline-flex h-7 w-7 items-center justify-center border border-stone-200/20 text-stone-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`${editor.moveUp}: ${column.label}`}
                          title={editor.moveUp}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={index === columns.length - 1}
                          onClick={() => onMoveField(column.id, 'down')}
                          className="inline-flex h-7 w-7 items-center justify-center border border-stone-200/20 text-stone-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`${editor.moveDown}: ${column.label}`}
                          title={editor.moveDown}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr className="group text-stone-200 hover:bg-white/[0.03]" style={{ height: rowHeights.label }}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-stone-200/12 bg-[rgb(var(--pm-panel))] px-3 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400 group-hover:bg-[rgb(var(--pm-rail))]"
              >
                {editor.columns.label}
                {renderRowResizeHandle('label', editor.columns.label)}
              </th>
              {columns.map((column) => {
                const isUuidField = isProgressUuidField(column.id);
                return (
                  <td key={column.id} className="overflow-hidden border-b border-r border-stone-200/10 px-3 py-3 align-top">
                    {isUuidField ? (
                      <span className="inline-flex h-8 max-w-44 items-center truncate px-2 text-sm font-medium text-violet-100">
                        {column.label}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={column.label}
                        aria-label={`${editor.columns.label}: ${column.label}`}
                        onChange={(event) => onUpdateField(column.id, { label: event.target.value })}
                        className="h-8 w-full min-w-0 border border-stone-200/20 bg-white/[0.03] px-2 text-sm text-stone-100"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
            <tr className="group text-stone-200 hover:bg-white/[0.03]" style={{ height: rowHeights.fieldId }}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-stone-200/12 bg-[rgb(var(--pm-panel))] px-3 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400 group-hover:bg-[rgb(var(--pm-rail))]"
              >
                {editor.columns.fieldId}
                {renderRowResizeHandle('fieldId', editor.columns.fieldId)}
              </th>
              {columns.map((column) => (
                <td key={column.id} className="overflow-hidden border-b border-r border-stone-200/10 px-3 py-3 align-top">
                  <span className="block max-w-44 truncate font-mono text-xs text-stone-400" title={column.id}>
                    {column.id}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="group text-stone-200 hover:bg-white/[0.03]" style={{ height: rowHeights.type }}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-stone-200/12 bg-[rgb(var(--pm-panel))] px-3 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400 group-hover:bg-[rgb(var(--pm-rail))]"
              >
                {editor.columns.type}
                {renderRowResizeHandle('type', editor.columns.type)}
              </th>
              {columns.map((column) => {
                const isUuidField = isProgressUuidField(column.id);
                return (
                  <td key={column.id} className="overflow-hidden border-b border-r border-stone-200/10 px-3 py-3 align-top">
                    {isUuidField ? (
                      <span className="inline-flex h-8 items-center px-2 text-sm text-stone-300">UUID</span>
                    ) : (
                      <select
                        value={column.fieldType}
                        aria-label={`${editor.columns.type}: ${column.label}`}
                        onChange={(event) => onUpdateField(column.id, {
                          fieldType: event.target.value as ProgressFieldType,
                        })}
                        className="h-8 w-full min-w-0 border border-stone-200/20 bg-white/[0.03] px-2 text-sm text-stone-100"
                      >
                        {fieldTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr className="group text-stone-200 hover:bg-white/[0.03]" style={{ height: rowHeights.visible }}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-stone-200/12 bg-[rgb(var(--pm-panel))] px-3 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400 group-hover:bg-[rgb(var(--pm-rail))]"
              >
                {editor.columns.visible}
                {renderRowResizeHandle('visible', editor.columns.visible)}
              </th>
              {columns.map((column) => {
                const isUuidField = isProgressUuidField(column.id);
                return (
                  <td key={column.id} className="overflow-hidden border-b border-r border-stone-200/10 px-3 py-3 align-top">
                    <label className={clsx(
                      'inline-flex min-h-8 items-center gap-2 text-xs text-stone-300',
                      isUuidField && 'opacity-70',
                    )}
                    >
                      <input
                        type="checkbox"
                        checked={column.visible !== false}
                        disabled={isUuidField}
                        onChange={(event) => onUpdateField(column.id, { visible: event.target.checked })}
                        className="h-3.5 w-3.5 accent-emerald-400"
                      />
                      {editor.visibleLabel}
                    </label>
                  </td>
                );
              })}
            </tr>
            <tr className="group text-stone-200 hover:bg-white/[0.03]" style={{ height: rowHeights.required }}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-stone-200/12 bg-[rgb(var(--pm-panel))] px-3 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400 group-hover:bg-[rgb(var(--pm-rail))]"
              >
                {editor.columns.required}
                {renderRowResizeHandle('required', editor.columns.required)}
              </th>
              {columns.map((column) => {
                const isUuidField = isProgressUuidField(column.id);
                return (
                  <td key={column.id} className="overflow-hidden border-b border-r border-stone-200/10 px-3 py-3 align-top">
                    <label className={clsx(
                      'inline-flex min-h-8 items-center gap-2 text-xs text-stone-300',
                      isUuidField && 'opacity-70',
                    )}
                    >
                      <input
                        type="checkbox"
                        checked={column.required === true}
                        disabled={isUuidField}
                        onChange={(event) => onUpdateField(column.id, { required: event.target.checked })}
                        className="h-3.5 w-3.5 accent-emerald-400"
                      />
                      {editor.requiredLabel}
                    </label>
                  </td>
                );
              })}
            </tr>
            <tr className="group text-stone-200 hover:bg-white/[0.03]" style={{ height: rowHeights.actions }}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-stone-200/12 bg-[rgb(var(--pm-panel))] px-3 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400 group-hover:bg-[rgb(var(--pm-rail))]"
              >
                {editor.columns.actions}
                {renderRowResizeHandle('actions', editor.columns.actions)}
              </th>
              {columns.map((column) => {
                const isProtected = protectedIds.has(column.id);
                return (
                  <td key={column.id} className="overflow-hidden border-b border-r border-stone-200/10 px-3 py-3 align-top">
                    <button
                      type="button"
                      disabled={isProtected}
                      onClick={() => onRemoveField(column.id)}
                      className="inline-flex h-8 items-center gap-1 border border-red-300/25 bg-red-500/10 px-2 text-xs text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`${editor.removeField}: ${column.label}`}
                    >
                      <Trash2 size={14} />
                      {editor.removeField}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
