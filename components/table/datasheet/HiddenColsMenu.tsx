'use client';

import React from 'react';
import { Settings2 } from 'lucide-react';
import type { Table } from '@tanstack/react-table';

export interface HideableColumnOption {
  id: string;
  label: string;
}

/**
 * Toolbar "Hidden (n)" dropdown for restoring/hiding columns (table-governance
 * §2.8). Only lists hideable columns; the gate forbids hiding the last identity
 * or last data column at the column-definition level.
 */
export function HiddenColsMenu<TData>({
  table,
  options,
  label = 'Hidden',
}: {
  table: Table<TData>;
  options: HideableColumnOption[];
  label?: string;
}) {
  const hiddenCount = options.filter((o) => table.getColumn(o.id)?.getIsVisible() === false).length;
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200 hover:bg-white/[0.04]">
        <Settings2 size={13} /> {label} ({hiddenCount})
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-56 border border-stone-200/15 bg-stone-950 p-2 shadow-xl">
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 px-2 py-1 text-xs text-stone-300">
            <input
              type="checkbox"
              checked={table.getColumn(option.id)?.getIsVisible() ?? true}
              onChange={(e) => table.getColumn(option.id)?.toggleVisibility(e.target.checked)}
              className="accent-emerald-400"
            />
            {option.label}
          </label>
        ))}
      </div>
    </details>
  );
}
