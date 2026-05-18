'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { useI18n } from '../../../lib/i18n';

type SelectMode = 'single' | 'multi';

export interface CategoryColumnFilterProps {
  header: string;
  categories: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  formatLabel?: (cat: string) => string;
}

export function CategoryColumnFilter({
  header,
  categories,
  selected,
  onChange,
  formatLabel,
}: CategoryColumnFilterProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SelectMode>('multi');
  const rootRef = useRef<HTMLDivElement>(null);

  const active = selected.size > 0;
  const label = (cat: string) => (formatLabel ? formatLabel(cat) : cat);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const applyAll = () => {
    if (selected.size === categories.length) onChange(new Set());
    else onChange(new Set(categories));
  };

  const clear = () => onChange(new Set());

  const toggleMulti = (cat: string) => {
    const next = new Set(selected);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onChange(next);
  };

  const pickSingle = (cat: string) => {
    if (selected.size === 1 && selected.has(cat)) onChange(new Set());
    else onChange(new Set([cat]));
  };

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-1 items-center gap-1">
      <span className="truncate">{header}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={clsx(
          'flex h-5 shrink-0 items-center gap-0.5 rounded border px-1 text-[10px] normal-case tracking-normal',
          active
            ? 'border-amber-300/50 bg-amber-300/15 text-amber-100'
            : 'border-stone-200/20 text-stone-400 hover:border-stone-200/40 hover:text-stone-200',
        )}
        title={active ? `${selected.size} categories selected` : 'Filter by category'}
      >
        <Filter size={10} />
        {active && <span>{selected.size}</span>}
        <ChevronDown size={10} className={clsx(open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-40 mt-1 w-56 rounded border border-stone-200/20 bg-[#061512] p-2 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex gap-1">
            {(['multi', 'single'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={clsx(
                  'flex-1 rounded border px-1.5 py-0.5 text-[10px] normal-case tracking-normal',
                  mode === m
                    ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100'
                    : 'border-stone-200/15 text-stone-400 hover:text-stone-200',
                )}
              >
                {m === 'multi' ? t.common.multiSelect : t.common.singleSelect}
              </button>
            ))}
          </div>

          <div className="mb-2 flex gap-1 border-b border-stone-200/10 pb-2">
            <button
              type="button"
              onClick={applyAll}
              className="flex-1 rounded border border-stone-200/15 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-stone-300 hover:bg-white/5 hover:text-stone-100"
            >
              {selected.size === categories.length ? t.common.deselectAll : t.common.selectAll}
            </button>
            {active && (
              <button
                type="button"
                onClick={clear}
                className="rounded border border-stone-200/15 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-stone-300 hover:bg-white/5 hover:text-stone-100"
              >
                {t.common.clear}
              </button>
            )}
          </div>

          <div className="max-h-48 overflow-auto">
            {categories.length === 0 && (
              <p className="px-1 py-2 text-[11px] text-stone-500">No categories</p>
            )}
            {categories.map((cat) => {
              const checked = selected.has(cat);
              return (
                <label
                  key={cat}
                  title={cat}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-white/5"
                >
                  <input
                    type={mode === 'single' ? 'radio' : 'checkbox'}
                    name="category-filter"
                    checked={checked}
                    onChange={() => (mode === 'single' ? pickSingle(cat) : toggleMulti(cat))}
                    className="h-3 w-3 accent-emerald-400"
                  />
                  <span className="truncate text-[11px] normal-case tracking-normal text-stone-200">
                    {label(cat)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
