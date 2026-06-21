'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutTemplate, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  DEVELOPMENT_TEMPLATE_ID,
  PROGRESS_FIELD_TYPE_OPTIONS,
  readStoredTemplateFieldColumns,
} from '../../../lib/progress-sheets/templateFieldPreferences';
import { isBuiltInTemplateId } from '../../../lib/progress-sheets/catalog';
import { persistSheetOrder } from '../../../components/sheets/sheetOrder';
import type { ProgressFieldType } from '../../../lib/types';
import { WorkstationFrame } from '../../../components/layout/WorkstationFrame';
import {
  BottomSheetTabs,
  type SheetTabItem,
} from '../../../components/sheets/BottomSheetTabs';
import { useI18n } from '../../../lib/i18n';
import { TemplateColumnsSheet } from './ProgressTemplates/TemplateColumnsSheet';
import { useTemplateFieldPreferences } from './ProgressTemplates/useTemplateFieldPreferences';
import { useProgressTemplatesCatalog } from './ProgressTemplates/useProgressTemplatesCatalog';

const SHEET_ORDER_STORAGE_KEY = 'projectManager.progressTemplatesSetting.sheetOrder';

export type ProgressTemplateSheetId = string;

function resolveHashTemplateId(templateIds: ReadonlySet<string>): ProgressTemplateSheetId | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  return templateIds.has(hash) ? hash : null;
}

export function ProgressTemplatesSettingView() {
  const { t } = useI18n();
  const copy = t.dashboard.progressTemplatesSetting;
  const editor = copy.templateEditor;
  const { templates, addSheet, deleteTemplate } = useProgressTemplatesCatalog();
  const [activeTemplateId, setActiveTemplateId] = useState<ProgressTemplateSheetId>(DEVELOPMENT_TEMPLATE_ID);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<ProgressFieldType>('text');
  const [newSheetLabel, setNewSheetLabel] = useState('');
  const [isAddingSheet, setIsAddingSheet] = useState(false);
  const newSheetInputRef = useRef<HTMLInputElement>(null);
  const templateIds = useMemo(() => new Set(templates.map((template) => template.id)), [templates]);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId),
    [activeTemplateId, templates],
  );

  const {
    columns,
    reset,
    saveUserDefault,
    resetUserDefault,
    resetSystemDefault,
    addField,
    updateField,
    removeField,
    moveField,
  } = useTemplateFieldPreferences(activeTemplateId);

  useEffect(() => {
    const syncHash = () => {
      const tab = resolveHashTemplateId(templateIds);
      if (tab) setActiveTemplateId(tab);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [templateIds]);

  useEffect(() => {
    if (templates.length === 0) return;
    if (!templateIds.has(activeTemplateId)) {
      setActiveTemplateId(templates[0]!.id);
    }
  }, [activeTemplateId, templateIds, templates]);

  useEffect(() => {
    if (isAddingSheet) {
      newSheetInputRef.current?.focus();
    }
  }, [isAddingSheet]);

  const onSelectTemplate = useCallback((templateId: ProgressTemplateSheetId) => {
    setActiveTemplateId(templateId);
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewSheetLabel('');
    if (typeof window !== 'undefined') {
      window.location.hash = templateId;
    }
  }, []);

  const tabs: ReadonlyArray<SheetTabItem<ProgressTemplateSheetId>> = useMemo(
    () => templates.map((template) => ({
      key: template.id,
      label: template.label,
      icon: <LayoutTemplate className="h-4 w-4" />,
      badge: isBuiltInTemplateId(template.id)
        ? readStoredTemplateFieldColumns(template.id).length
        : template.fields.length,
      activeClassName: 'bg-violet-600/85 text-white shadow-sm',
      iconClassName: 'text-violet-200',
      ariaLabel: `${template.label} sheet`,
      title: `${template.label} column template. Drag to reorder.`,
    })),
    [templates],
  );

  const handleAddField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    addField(label, newFieldType);
    setNewFieldLabel('');
    setNewFieldType('text');
  };

  const handleAddSheet = () => {
    const label = newSheetLabel.trim();
    if (!label || !activeTemplate) return;
    const created = addSheet(activeTemplate.id, label);
    setNewSheetLabel('');
    setIsAddingSheet(false);
    onSelectTemplate(created.id);
  };

  const cancelAddSheet = () => {
    setNewSheetLabel('');
    setIsAddingSheet(false);
  };

  const handleDeleteSheet = () => {
    if (!activeTemplate || isBuiltInTemplateId(activeTemplate.id)) return;
    const deletedTemplateId = activeTemplate.id;
    const nextTemplates = templates.filter((template) => template.id !== deletedTemplateId);
    const fallbackTemplateId =
      nextTemplates.find((template) => template.id === DEVELOPMENT_TEMPLATE_ID)?.id
      ?? nextTemplates[0]?.id
      ?? DEVELOPMENT_TEMPLATE_ID;
    deleteTemplate(activeTemplate.id);
    setNewSheetLabel('');
    persistSheetOrder(
      SHEET_ORDER_STORAGE_KEY,
      nextTemplates.map((template) => template.id),
    );
    setActiveTemplateId(fallbackTemplateId);
    if (typeof window !== 'undefined') {
      window.location.hash = fallbackTemplateId;
    }
  };

  const activeTemplateIsBuiltIn = activeTemplate ? isBuiltInTemplateId(activeTemplate.id) : false;

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
          {!activeTemplateIsBuiltIn && activeTemplate && (
            <>
              <button
                type="button"
                onClick={handleDeleteSheet}
                className="inline-flex h-8 items-center gap-1.5 border border-red-300/25 bg-red-500/10 px-3 text-xs font-medium text-red-100 hover:bg-red-500/20"
              >
                <Trash2 size={14} />
                Delete Sheet
              </button>
              <div className="h-8 w-px bg-stone-200/10" aria-hidden />
            </>
          )}
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
            onClick={activeTemplateIsBuiltIn ? reset : resetSystemDefault}
            disabled={!activeTemplate}
            className="inline-flex h-8 items-center gap-1.5 border border-stone-200/20 px-3 text-xs font-medium text-stone-300 hover:bg-white/5"
          >
            <RotateCcw size={14} />
            {activeTemplateIsBuiltIn ? editor.resetDefaults : editor.resetSystemDefault}
          </button>
          {!activeTemplateIsBuiltIn && activeTemplate && (
            <>
              <button
                type="button"
                onClick={saveUserDefault}
                className="inline-flex h-8 items-center gap-1.5 border border-sky-300/30 bg-sky-500/10 px-3 text-xs font-medium text-sky-100 hover:bg-sky-500/20"
              >
                {editor.saveUserDefault}
              </button>
              <button
                type="button"
                onClick={resetUserDefault}
                className="inline-flex h-8 items-center gap-1.5 border border-stone-200/20 px-3 text-xs font-medium text-stone-300 hover:bg-white/5"
              >
                <RotateCcw size={14} />
                {editor.resetUserDefault}
              </button>
            </>
          )}
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
        <div className="relative">
          {isAddingSheet && (
            <form
              aria-label="Create sheet"
              onSubmit={(event) => {
                event.preventDefault();
                handleAddSheet();
              }}
              className="absolute bottom-full left-2 z-20 mb-2 flex min-w-[260px] items-center gap-2 border border-violet-300/35 bg-[rgb(var(--pm-rail))]/95 p-2 shadow-2xl ring-1 ring-white/10"
            >
              <input
                ref={newSheetInputRef}
                type="text"
                value={newSheetLabel}
                onChange={(event) => setNewSheetLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelAddSheet();
                  }
                }}
                placeholder="e.g. Mobile App QA"
                className="h-8 min-w-0 flex-1 border border-stone-200/20 bg-white/[0.03] px-2 text-sm text-stone-100 placeholder:text-stone-500"
              />
              <button
                type="submit"
                disabled={!newSheetLabel.trim() || !activeTemplate}
                className="inline-flex h-8 items-center border border-violet-300/35 bg-violet-500/15 px-3 text-xs font-medium text-violet-100 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create
              </button>
            </form>
          )}
          <BottomSheetTabs
            tabs={tabs}
            activeKey={activeTemplateId}
            onSelect={onSelectTemplate}
            leadingAction={
              <button
                type="button"
                aria-label="Add sheet"
                title="Add sheet"
                onClick={() => setIsAddingSheet((current) => !current)}
                className="relative flex h-[42px] w-11 shrink-0 items-center justify-center border-r border-stone-200/15 text-lg font-semibold leading-none text-stone-300/85 transition-colors hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
              >
                <Plus size={17} aria-hidden="true" />
              </button>
            }
            reorderable
            orderStorageKey={SHEET_ORDER_STORAGE_KEY}
          />
        </div>
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
