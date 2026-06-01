'use client';

import React from 'react';
import { Snowflake } from 'lucide-react';

/**
 * Company-standard numeric Freeze cols control (table-governance.md §2.4):
 * a number input that freezes the leftmost N columns. This is the ONLY approved
 * freeze affordance — do not use a per-column checkbox dropdown. Reference:
 * `app/ui/views/Keys/KeysProviderTable.tsx`.
 */
export function FreezeColsControl({
  id,
  count,
  max,
  label,
  onChangeCount,
}: {
  id: string;
  count: number;
  max: number;
  label: string;
  onChangeCount: (value: string) => void;
}) {
  return (
    <div className="flex h-8 items-center gap-1 border border-stone-200/18 px-2 text-xs text-stone-200">
      <Snowflake size={13} className="text-cyan-300" />
      <label htmlFor={id} className="text-[10px] text-stone-400">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={max}
        value={count}
        aria-label={label}
        onChange={(event) => onChangeCount(event.target.value)}
        className="h-6 w-11 border border-stone-200/18 bg-[rgb(var(--pm-input))] px-1 text-center text-xs text-stone-100 outline-none focus:ring-1 focus:ring-emerald-400/50"
      />
    </div>
  );
}
