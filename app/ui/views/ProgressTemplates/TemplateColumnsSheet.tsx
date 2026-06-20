'use client';

// @table-classification: simple
// @table-reason: Each discipline template sheet lists fewer than 20 column rows
//   with inline edit controls; horizontal scroll is handled by pm-scroll parent.

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
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[rgb(var(--pm-rail))]/95 text-[11px] uppercase tracking-[0.08em] text-stone-400">
            <tr>
              <th className="border-b border-stone-200/15 px-3 py-2 font-medium">{editor.columns.order}</th>
              <th className="border-b border-stone-200/15 px-3 py-2 font-medium">{editor.columns.label}</th>
              <th className="border-b border-stone-200/15 px-3 py-2 font-medium">{editor.columns.fieldId}</th>
              <th className="border-b border-stone-200/15 px-3 py-2 font-medium">{editor.columns.type}</th>
              <th className="border-b border-stone-200/15 px-3 py-2 font-medium">{editor.columns.visible}</th>
              <th className="border-b border-stone-200/15 px-3 py-2 font-medium">{editor.columns.required}</th>
              <th className="border-b border-stone-200/15 px-3 py-2 font-medium">{editor.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column, index) => {
              const isUuidField = isProgressUuidField(column.id);
              const isProtected = protectedIds.has(column.id);
              return (
                <tr
                  key={column.id}
                  className={clsx(
                    'border-b border-stone-200/10 text-stone-200 hover:bg-white/[0.03]',
                    isUuidField && 'bg-violet-500/[0.06]',
                  )}
                >
                  <td className="px-3 py-2 align-top">
                    {isUuidField ? (
                      <span className="inline-flex h-7 items-center px-1 text-[11px] text-stone-500">—</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => onMoveField(column.id, 'up')}
                          className="inline-flex h-7 w-7 items-center justify-center border border-stone-200/20 text-stone-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={editor.moveUp}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={index === columns.length - 1}
                          onClick={() => onMoveField(column.id, 'down')}
                          className="inline-flex h-7 w-7 items-center justify-center border border-stone-200/20 text-stone-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={editor.moveDown}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {isUuidField ? (
                      <span className="inline-flex h-8 items-center px-2 text-sm font-medium text-violet-100">
                        {column.label}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={column.label}
                        onChange={(event) => onUpdateField(column.id, { label: event.target.value })}
                        className="h-8 w-full min-w-[160px] border border-stone-200/20 bg-white/[0.03] px-2 text-sm text-stone-100"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="font-mono text-xs text-stone-400">{column.id}</span>
                    {isUuidField ? (
                      <span className="ml-2 border border-violet-300/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-100">
                        {editor.supabaseUuidReserved}
                      </span>
                    ) : isProtected ? (
                      <span className="ml-2 border border-amber-300/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-100">
                        {editor.protected}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {isUuidField ? (
                      <span className="inline-flex h-8 items-center px-2 text-sm text-stone-300">UUID</span>
                    ) : (
                      <select
                        value={column.fieldType}
                        onChange={(event) => onUpdateField(column.id, {
                          fieldType: event.target.value as ProgressFieldType,
                        })}
                        className="h-8 w-full min-w-[140px] border border-stone-200/20 bg-white/[0.03] px-2 text-sm text-stone-100"
                      >
                        {PROGRESS_FIELD_TYPE_OPTIONS.filter((option) => option.value !== 'uuid').map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <label className={clsx(
                      'inline-flex items-center gap-2 text-xs text-stone-300',
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
                  <td className="px-3 py-2 align-top">
                    <label className={clsx(
                      'inline-flex items-center gap-2 text-xs text-stone-300',
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
                  <td className="px-3 py-2 align-top">
                    <button
                      type="button"
                      disabled={isProtected}
                      onClick={() => onRemoveField(column.id)}
                      className="inline-flex h-8 items-center gap-1 border border-red-300/25 bg-red-500/10 px-2 text-xs text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                      {editor.removeField}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
