'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutTemplate, Plus, RotateCcw } from 'lucide-react';
import { BUILT_IN_PROGRESS_TEMPLATES } from '../../../lib/progress-sheets/templates';
import {
  DEVELOPMENT_TEMPLATE_ID,
  PROGRESS_FIELD_TYPE_OPTIONS,
} from '../../../lib/progress-sheets/templateFieldPreferences';
import type { ProgressFieldType } from '../../../lib/types';
import { WorkstationFrame } from '../../../components/layout/WorkstationFrame';
import {
  BottomSheetTabs,
  type SheetTabItem,
} from '../../../components/sheets/BottomSheetTabs';
import { useI18n } from '../../../lib/i18n';
import { TemplateColumnsSheet } from './ProgressTemplates/TemplateColumnsSheet';
import { useTemplateFieldPreferences } from './ProgressTemplates/useTemplateFieldPreferences';

const SHEET_ORDER_STORAGE_KEY = 'projectManager.progressTemplatesSetting.sheetOrder';

export type ProgressTemplateSheetId = (typeof BUILT_IN_PROGRESS_TEMPLATES)[number]['id'];

function resolveHashTemplateId(): ProgressTemplateSheetId | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  return BUILT_IN_PROGRESS_TEMPLATES.some((template) => template.id === hash)
    ? hash as ProgressTemplateSheetId
    : null;
}

export function ProgressTemplatesSettingView() {
  const { t } = useI18n();
  const copy = t.dashboard.progressTemplatesSetting;
  const editor = copy.templateEditor;
  const [activeTemplateId, setActiveTemplateId] = useState<ProgressTemplateSheetId>(DEVELOPMENT_TEMPLATE_ID);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<ProgressFieldType>('text');

  const activeTemplate = useMemo(
    () => BUILT_IN_PROGRESS_TEMPLATES.find((template) => template.id === activeTemplateId),
    [activeTemplateId],
  );

  const {
    columns,
    reset,
    addField,
    updateField,
    removeField,
    moveField,
  } = useTemplateFieldPreferences(activeTemplateId);

  useEffect(() => {
    const syncHash = () => {
      const tab = resolveHashTemplateId();
      if (tab) setActiveTemplateId(tab);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const onSelectTemplate = useCallback((templateId: ProgressTemplateSheetId) => {
    setActiveTemplateId(templateId);
    setNewFieldLabel('');
    setNewFieldType('text');
    if (typeof window !== 'undefined') {
      window.location.hash = templateId;
    }
  }, []);

  const tabs: ReadonlyArray<SheetTabItem<ProgressTemplateSheetId>> = useMemo(
    () => BUILT_IN_PROGRESS_TEMPLATES.map((template) => ({
      key: template.id,
      label: template.label,
      icon: <LayoutTemplate className="h-4 w-4" />,
      badge: template.fields.length,
      activeClassName: 'bg-violet-600/85 text-white shadow-sm',
      iconClassName: 'text-violet-200',
      ariaLabel: `${template.label} sheet`,
      title: `${template.label} column template. Drag to reorder.`,
    })),
    [],
  );

  const handleAddField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    addField(label, newFieldType);
    setNewFieldLabel('');
    setNewFieldType('text');
  };

  return (
    <WorkstationFrame
      className="w-full"
      header={
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-50">
            <LayoutTemplate className="h-5 w-5 text-violet-200" />
            {copy.title}
          </h1>
          <p className="mt-1 text-xs text-stone-400">{copy.subtitle}</p>
        </div>
      }
      toolbar={
        <div className="flex flex-wrap items-end gap-2 border-b border-stone-200/12 bg-[rgb(var(--pm-rail))]/40 px-4 py-3">
          <label className="min-w-[220px] flex-1">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-stone-400">
              {editor.addFieldLabel}
            </span>
            <input
              type="text"
              value={newFieldLabel}
              onChange={(event) => setNewFieldLabel(event.target.value)}
              placeholder={editor.addFieldPlaceholder}
              className="h-8 w-full border border-stone-200/20 bg-white/[0.03] px-2 text-sm text-stone-100 placeholder:text-stone-500"
            />
          </label>
          <label className="min-w-[160px]">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-stone-400">
              {editor.fieldType}
            </span>
            <select
              value={newFieldType}
              onChange={(event) => setNewFieldType(event.target.value as ProgressFieldType)}
              className="h-8 w-full border border-stone-200/20 bg-white/[0.03] px-2 text-sm text-stone-100"
            >
              {PROGRESS_FIELD_TYPE_OPTIONS.filter((option) => option.value !== 'uuid').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleAddField}
            disabled={!newFieldLabel.trim()}
            className="inline-flex h-8 items-center gap-1.5 border border-emerald-300/35 bg-emerald-500/15 px-3 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} />
            {editor.addField}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-8 items-center gap-1.5 border border-stone-200/20 px-3 text-xs font-medium text-stone-300 hover:bg-white/5"
          >
            <RotateCcw size={14} />
            {editor.resetDefaults}
          </button>
          {activeTemplate && (
            <p className="w-full text-[11px] text-violet-100/80">
              {editor.activeTemplate}: {activeTemplate.sheetTitle}
            </p>
          )}
        </div>
      }
      panelClassName="border border-stone-200/15 bg-[rgb(var(--pm-panel))]/72"
      scrollChildren={false}
      bottomTabs={
        <BottomSheetTabs
          tabs={tabs}
          activeKey={activeTemplateId}
          onSelect={onSelectTemplate}
          reorderable
          orderStorageKey={SHEET_ORDER_STORAGE_KEY}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col p-4">
        {activeTemplate ? (
          <TemplateColumnsSheet
            templateId={activeTemplate.id}
            templateLabel={activeTemplate.label}
            sheetTitle={activeTemplate.sheetTitle}
            columns={columns}
            onUpdateField={updateField}
            onRemoveField={removeField}
            onMoveField={moveField}
          />
        ) : null}
      </div>
    </WorkstationFrame>
  );
}
