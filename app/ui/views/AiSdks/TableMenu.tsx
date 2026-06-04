'use client';

/**
 * Toolbar dropdown for hidden-column/row recovery in AI SDKs sheets.
 * Column/row spreadsheet actions (sort, resize, hide, freeze) use right-click
 * context menus per company table-governance — not header/row ⋮ icons.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

export type TableMenuItem =
  | { separator: true; key: string }
  | {
      key: string;
      label: string;
      icon?: React.ReactNode;
      onSelect: () => void;
      disabled?: boolean;
      danger?: boolean;
      checked?: boolean;
    };

interface TableMenuProps {
  /** Trigger button content (usually an icon). */
  trigger: React.ReactNode;
  triggerLabel: string;
  triggerClassName?: string;
  items: TableMenuItem[];
  align?: 'left' | 'right';
  /** Stops click/keydown from bubbling to a parent row/header handler. */
  stopPropagation?: boolean;
}

export function TableMenu({
  trigger,
  triggerLabel,
  triggerClassName,
  items,
  align = 'right',
  stopPropagation = true,
}: TableMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    // Focus the first enabled item for keyboard users.
    const first = listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    first?.focus();
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const stop = (e: React.SyntheticEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  const moveFocus = (current: HTMLElement, delta: number) => {
    const nodes = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    const idx = nodes.indexOf(current);
    const next = nodes[(idx + delta + nodes.length) % nodes.length];
    next?.focus();
  };

  return (
    <div ref={rootRef} className="relative inline-flex" onClick={stop}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            stop(e);
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={
          triggerClassName ??
          'inline-flex h-6 w-6 items-center justify-center text-stone-500 hover:text-stone-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-emerald-300'
        }
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          className={`absolute top-full z-50 mt-1 min-w-[200px] border border-stone-200/20 bg-[rgb(var(--pm-panel))] py-1 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) =>
            'separator' in item ? (
              <div key={item.key} role="separator" className="my-1 border-t border-stone-200/12" />
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  stop(e);
                  if (item.disabled) return;
                  item.onSelect();
                  close(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    moveFocus(e.currentTarget, 1);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    moveFocus(e.currentTarget, -1);
                  }
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger
                    ? 'text-rose-200 hover:bg-rose-500/15'
                    : 'text-stone-200 hover:bg-white/[0.06]'
                }`}
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-stone-400">
                  {item.icon ?? (item.checked ? '✓' : null)}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
