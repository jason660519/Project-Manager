'use client';

import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  /** Tailwind background class (e.g. 'bg-emerald-500/15'). */
  bgClass: string;
  /** Tailwind text colour class for the icon (e.g. 'text-emerald-300'). */
  colorClass: string;
  compact?: boolean;
}

export function StatCard({ label, value, subValue, icon: Icon, bgClass, colorClass, compact = false }: StatCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70 px-2 py-1">
        <div className={clsx('flex h-7 w-7 items-center justify-center rounded', bgClass)}>
          <Icon className={clsx('h-3.5 w-3.5', colorClass)} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.1em] text-stone-400 leading-tight whitespace-nowrap">{label}</p>
          <p className="text-sm font-semibold text-stone-100 leading-tight">
            {value}
            {subValue && <span className="ml-1 text-[10px] text-stone-400 font-normal">{subValue}</span>}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 rounded border border-stone-200/15 bg-[rgb(var(--pm-card))]/70 px-4 py-3">
      <div className={clsx('flex h-12 w-12 items-center justify-center rounded', bgClass)}>
        <Icon className={clsx('h-5 w-5', colorClass)} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-stone-400">{label}</p>
        <p className="mt-1 text-xl font-semibold text-stone-100">
          {value}
          {subValue && <span className="ml-1 text-xs text-stone-400 font-normal">{subValue}</span>}
        </p>
      </div>
    </div>
  );
}
