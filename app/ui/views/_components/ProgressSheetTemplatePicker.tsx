'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, LayoutTemplate } from 'lucide-react';
import { clsx } from 'clsx';
import type { BuiltInProgressTemplate } from '../../../../lib/progress-sheets/templates';
import { en } from '../../../../lib/i18n';

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export interface ProgressSheetTemplatePickerProps {
  templates: ReadonlyArray<BuiltInProgressTemplate>;
  selectedIds: string[];
  onToggle: (templateId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  disabled?: boolean;
}

function summarizeSelection(
  templates: ReadonlyArray<BuiltInProgressTemplate>,
  selectedIds: string[],
): string {
  if (selectedIds.length === 0) return 'Select progress sheets…';
  const labels = templates
    .filter((template) => selectedIds.includes(template.id))
    .map((template) => template.label);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
  return `${labels[0]} +${labels.length - 1}`;
}

export function ProgressSheetTemplatePicker({
  templates,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  disabled = false,
}: ProgressSheetTemplatePickerProps) {
  const copy = en.common;
  const [open, setOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(selectedIds);
  const allSelected = selectedIds.length === templates.length && templates.length > 0;
  const summary = summarizeSelection(templates, selectedIds);

  const updateDropdownPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 4;
    const preferredMaxHeight = 224;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openBelow = spaceBelow >= 120 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(
      96,
      Math.min(preferredMaxHeight, openBelow ? spaceBelow - gap : spaceAbove - gap),
    );
    setDropdownPosition({
      top: openBelow ? rect.bottom + gap : rect.top - gap - maxHeight,
      left: Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - 288 - viewportPadding)),
      width: Math.max(rect.width, 288),
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target)
        || menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onReposition = () => updateDropdownPosition();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateDropdownPosition]);

  return (
    <div ref={rootRef} className="relative min-w-[220px]">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => {
            const next = !value;
            if (next) updateDropdownPosition();
            return next;
          });
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          'flex h-7 w-full min-w-0 items-center gap-1.5 border px-2 text-left text-[11px] disabled:cursor-not-allowed disabled:opacity-40',
          selectedIds.length > 0
            ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'
            : 'border-stone-200/20 bg-white/[0.025] text-stone-300 hover:bg-white/[0.055]',
        )}
        title={summary}
      >
        <LayoutTemplate size={12} className="shrink-0 opacity-80" />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        {selectedIds.length > 1 && (
          <span className="shrink-0 rounded bg-emerald-500/20 px-1 py-0.5 text-[10px] font-medium">
            {selectedIds.length}
          </span>
        )}
        <ChevronDown size={12} className={clsx('shrink-0 opacity-70', open && 'rotate-180')} />
      </button>

      {open && dropdownPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-multiselectable="true"
          className="fixed z-[120] rounded border border-stone-200/20 bg-[rgb(var(--pm-rail))] p-2 shadow-xl"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-2 flex gap-1 border-b border-stone-200/10 pb-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="flex-1 rounded border border-stone-200/15 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-stone-300 hover:bg-white/5 hover:text-stone-100"
            >
              {allSelected ? copy.deselectAll : copy.selectAll}
            </button>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="rounded border border-stone-200/15 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-stone-300 hover:bg-white/5 hover:text-stone-100"
              >
                {copy.clear}
              </button>
            )}
          </div>

          <div className="overflow-auto" style={{ maxHeight: dropdownPosition.maxHeight }}>
            {templates.map((template) => {
              const checked = selectedSet.has(template.id);
              return (
                <label
                  key={template.id}
                  title={template.sheetTitle}
                  className={clsx(
                    'flex cursor-pointer items-start gap-2 rounded px-1 py-1.5 hover:bg-white/5',
                    checked && 'bg-emerald-500/10',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(template.id)}
                    className="mt-0.5 h-3 w-3 shrink-0 accent-emerald-400"
                    aria-label={`${template.label} progress sheet`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] text-stone-100">{template.label}</span>
                    <span className="block truncate text-[10px] text-stone-500">
                      {template.fields.length} fields · {template.statusOptions.length} statuses
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
