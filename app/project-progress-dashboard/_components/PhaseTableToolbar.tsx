'use client';

import { useState } from 'react';
import { Search, Plus, AlignLeft, AlignCenter, AlignRight, Snowflake, EyeOff, Save, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import type { ColumnAlignment, PhaseTablePrefs, WidthPreset } from '../types';
import type { ColumnDef } from '../_lib/columns';

interface PhaseTableToolbarProps {
  prefs: PhaseTablePrefs;
  patch: (next: Partial<PhaseTablePrefs>) => void;
  reset: () => void;
  columns: ColumnDef[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showHiddenRows: boolean;
  onShowHiddenRowsChange: (v: boolean) => void;
  hiddenRowsCount: number;
  onAddRow: () => void;
}

export function PhaseTableToolbar({
  prefs, patch, reset, columns, searchQuery, onSearchChange,
  showHiddenRows, onShowHiddenRowsChange, hiddenRowsCount, onAddRow,
}: PhaseTableToolbarProps) {
  const [presetName, setPresetName] = useState('');
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const setColumnAlignment = (idx: number, alignment: ColumnAlignment) => {
    const next = [...prefs.columnAlignments];
    next[idx] = alignment;
    patch({ columnAlignments: next });
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    const preset: WidthPreset = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`,
      name: presetName.trim(),
      widths: [...prefs.colWidths],
    };
    patch({ widthPresets: [...prefs.widthPresets, preset] });
    setPresetName('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-stone-200/15 bg-[rgb(var(--pm-card))]/40 px-3 py-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" size={12} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search…"
          className="h-7 w-44 rounded border border-stone-200/15 bg-[rgb(var(--pm-rail))]/80 pl-7 pr-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-emerald-400/40"
        />
      </div>

      <div className="flex-1" />

      {/* Alignment menu */}
      <div className="relative">
        <button
          onClick={() => { setShowAlignMenu((v) => !v); setShowPresetMenu(false); }}
          className="flex h-7 items-center gap-1 rounded border border-stone-200/15 px-2 text-xs text-stone-300 hover:text-stone-100"
        >
          <AlignLeft size={12} /> Align
        </button>
        {showAlignMenu && (
          <div className="absolute right-0 top-8 z-30 w-64 rounded border border-stone-200/20 bg-[rgb(var(--pm-rail))] p-2 shadow-xl">
            <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-stone-400">Column alignment</p>
            {columns.map((col, idx) => (
              <div key={col.id} className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-stone-200">{col.header || col.id}</span>
                <div className="flex gap-0.5">
                  {(['left', 'center', 'right'] as ColumnAlignment[]).map((a) => {
                    const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                    return (
                      <button
                        key={a}
                        onClick={() => setColumnAlignment(idx, a)}
                        className={clsx(
                          'flex h-5 w-5 items-center justify-center rounded',
                          prefs.columnAlignments[idx] === a
                            ? 'bg-emerald-500/25 text-emerald-200'
                            : 'text-stone-400 hover:text-stone-200',
                        )}
                      >
                        <Icon size={11} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Freeze controls */}
      <div className="flex items-center gap-1 border-l border-stone-200/15 pl-2">
        <Snowflake size={12} className="text-cyan-300" />
        <label className="text-[10px] text-stone-400">rows</label>
        <input
          type="number"
          min={0}
          max={5}
          value={prefs.freezeRowCount}
          onChange={(e) => patch({ freezeRowCount: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })}
          className="h-6 w-10 rounded border border-stone-200/15 bg-[rgb(var(--pm-rail))]/80 px-1 text-center text-xs text-stone-100"
        />
        <label className="text-[10px] text-stone-400">cols</label>
        <input
          type="number"
          min={0}
          max={5}
          value={prefs.frozenDataColCount}
          onChange={(e) => patch({ frozenDataColCount: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })}
          className="h-6 w-10 rounded border border-stone-200/15 bg-[rgb(var(--pm-rail))]/80 px-1 text-center text-xs text-stone-100"
        />
      </div>

      {/* Hidden rows toggle */}
      <button
        onClick={() => onShowHiddenRowsChange(!showHiddenRows)}
        className={clsx(
          'flex h-7 items-center gap-1 rounded border px-2 text-xs',
          showHiddenRows
            ? 'border-stone-100/50 bg-stone-200/10 text-stone-100'
            : 'border-stone-200/15 text-stone-300 hover:text-stone-100',
        )}
        title={`${hiddenRowsCount} hidden`}
      >
        <EyeOff size={12} /> Hidden ({hiddenRowsCount})
      </button>

      {/* Width preset menu */}
      <div className="relative">
        <button
          onClick={() => { setShowPresetMenu((v) => !v); setShowAlignMenu(false); }}
          className="flex h-7 items-center gap-1 rounded border border-stone-200/15 px-2 text-xs text-stone-300 hover:text-stone-100"
        >
          <Save size={12} /> Presets
        </button>
        {showPresetMenu && (
          <div className="absolute right-0 top-8 z-30 w-60 rounded border border-stone-200/20 bg-[rgb(var(--pm-rail))] p-2 shadow-xl">
            <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-stone-400">Width presets</p>
            <div className="mb-2 flex items-center gap-1">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="preset name"
                className="h-6 flex-1 rounded border border-stone-200/15 bg-[rgb(var(--pm-rail))] px-2 text-xs text-stone-100"
              />
              <button
                onClick={savePreset}
                className="h-6 rounded bg-emerald-500/30 px-2 text-xs text-emerald-100 hover:bg-emerald-500/40"
              >save</button>
            </div>
            {prefs.widthPresets.length === 0 && (
              <p className="text-[11px] text-stone-500">No presets saved.</p>
            )}
            {prefs.widthPresets.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded py-1 hover:bg-white/5">
                <button
                  onClick={() => patch({ colWidths: p.widths })}
                  className="flex-1 text-left text-[11px] text-stone-200 hover:text-stone-100"
                >{p.name}</button>
                <button
                  onClick={() => patch({ widthPresets: prefs.widthPresets.filter((x) => x.id !== p.id) })}
                  className="text-[10px] text-red-300 hover:text-red-200"
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={reset}
        className="flex h-7 items-center gap-1 rounded border border-stone-200/15 px-2 text-xs text-stone-300 hover:text-stone-100"
        title="Reset table preferences"
      >
        <RotateCcw size={12} /> Reset
      </button>

      <button
        onClick={onAddRow}
        className="flex h-7 items-center gap-1 rounded bg-emerald-500/30 px-2 text-xs text-emerald-100 hover:bg-emerald-500/40"
      >
        <Plus size={12} /> Add Row
      </button>
    </div>
  );
}
