'use client';

import React from 'react';
import { clsx } from 'clsx';

/**
 * Excel-style bottom sheet tabs — sits in the bottomTabs slot of
 * WorkstationFrame. Active tab uses an emerald background and a top white
 * indicator line (signalling that this tab's content is shown above, the
 * standard Excel visual metaphor).
 *
 * The generic <Key> lets callers narrow the key union (e.g. 'api_key_validation'
 * | 'llm_arena') so onSelect is type-safe per view.
 */
export interface SheetTabItem<Key extends string> {
  key: Key;
  label: string;
  icon?: React.ReactNode;
  /** Optional trailing count badge (e.g. feature count, error count). */
  badge?: React.ReactNode;
}

export interface BottomSheetTabsProps<Key extends string> {
  tabs: ReadonlyArray<SheetTabItem<Key>>;
  activeKey: Key;
  onSelect: (key: Key) => void;
  className?: string;
}

export function BottomSheetTabs<Key extends string>({
  tabs,
  activeKey,
  onSelect,
  className,
}: BottomSheetTabsProps<Key>) {
  return (
    <div
      className={clsx(
        'flex flex-none items-end overflow-x-auto border-t border-stone-200/15 bg-[rgb(var(--pm-rail))]/70',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            className={clsx(
              'relative flex items-center gap-2 whitespace-nowrap border-r border-stone-200/15 px-4 py-2.5 text-sm font-medium transition-colors last:border-r-0',
              active
                ? 'bg-emerald-600/85 text-white shadow-sm'
                : 'text-stone-300/85 hover:bg-white/5 hover:text-stone-100',
            )}
          >
            {tab.icon && (
              <span className={active ? 'text-current' : 'text-amber-100'}>{tab.icon}</span>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={clsx(
                  'ml-1 px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                  active ? 'bg-white/25 text-white' : 'bg-stone-200/15 text-stone-100',
                )}
              >
                {tab.badge}
              </span>
            )}
            {active && <span className="absolute left-0 right-0 top-0 h-0.5 bg-white/60" />}
          </button>
        );
      })}
      <div className="min-w-[20px] flex-1" />
    </div>
  );
}
